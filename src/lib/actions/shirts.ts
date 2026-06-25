"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

function parseSizes(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/\r?\n/).map((line, index) => {
    const [label, price] = line.split(",").map((part) => part.trim());
    return { size_label: label, price_cents: Math.round(Number(price) * 100), sort_order: index * 10 };
  }).filter((row) => row.size_label && Number.isInteger(row.price_cents) && row.price_cents >= 0);
}

async function uploadShirtImages(admin: ReturnType<typeof createAdminClient>, designId: string, files: File[]) {
  const uploaded: { design_id: string; storage_path: string; sort_order: number }[] = [];

  for (const [index, file] of files.entries()) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Upload JPG, PNG, or WebP shirt images.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Each shirt image must be 10 MB or smaller.");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storage_path = `designs/${designId}/${Date.now()}-${index}.${ext}`;
    const { error } = await admin.storage.from("shirt-images").upload(storage_path, file, {
      contentType: file.type,
      upsert: false
    });
    if (error) {
      throw error;
    }
    uploaded.push({ design_id: designId, storage_path, sort_order: index * 10 });
  }

  if (uploaded.length) {
    const { error } = await admin.from("shirt_design_images").insert(uploaded);
    if (error) {
      await admin.storage.from("shirt-images").remove(uploaded.map((image) => image.storage_path));
      throw error;
    }
  }
}

export async function createShirtDesign(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  const sizes = parseSizes(formData.get("sizes"));
  const images = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (!name || !sizes.length) redirect(`/admin/shirts?error=${encodeURIComponent("Enter a design name and at least one size/price line.")}`);

  const { data: design, error } = await admin.from("shirt_designs").insert({
    name, description: String(formData.get("description") ?? "").trim(), image_path: null
  }).select("id").single();
  if (error || !design) redirect(`/admin/shirts?error=${encodeURIComponent(error?.message ?? "Could not create design.")}`);
  try {
    await uploadShirtImages(admin, design.id, images);
  } catch (uploadError) {
    await admin.from("shirt_designs").delete().eq("id", design.id);
    redirect(`/admin/shirts?error=${encodeURIComponent(uploadError instanceof Error ? uploadError.message : "Could not upload shirt images.")}`);
  }
  const { error: sizeError } = await admin.from("shirt_design_sizes").insert(sizes.map((size) => ({ ...size, design_id: design.id })));
  if (sizeError) redirect(`/admin/shirts?error=${encodeURIComponent(sizeError.message)}`);
  revalidatePath("/admin/shirts");
  redirect("/admin/shirts?saved=design");
}

export async function addShirtDesignImages(formData: FormData) {
  await requireAdmin();
  const design_id = String(formData.get("design_id") ?? "");
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const admin = createAdminClient();

  if (!files.length) {
    redirect(`/admin/shirts?error=${encodeURIComponent("Choose at least one image.")}`);
  }

  const { count } = await admin
    .from("shirt_design_images")
    .select("id", { count: "exact", head: true })
    .eq("design_id", design_id);

  try {
    await uploadShirtImages(admin, design_id, files);
    if ((count ?? 0) > 0) {
      const { data: newImages } = await admin
        .from("shirt_design_images")
        .select("id")
        .eq("design_id", design_id)
        .order("created_at", { ascending: false })
        .limit(files.length);
      for (const [index, image] of (newImages ?? []).reverse().entries()) {
        await admin.from("shirt_design_images").update({ sort_order: ((count ?? 0) + index) * 10 }).eq("id", image.id);
      }
    }
  } catch (error) {
    redirect(`/admin/shirts?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not upload shirt images.")}`);
  }

  revalidatePath("/admin/shirts");
  redirect("/admin/shirts?saved=images");
}
export async function assignShirtDesign(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const design_id = String(formData.get("design_id") ?? "");
  const admin = createAdminClient();
  const { error } = await admin.from("event_shirt_designs").upsert({ event_id, design_id, active: true });
  if (error) redirect(`/admin/events/${event_id}/shirts?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/events/${event_id}/shirts`);
  redirect(`/admin/events/${event_id}/shirts?saved=assigned`);
}

export async function removeShirtDesignFromEvent(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const design_id = String(formData.get("design_id") ?? "");
  const admin = createAdminClient();
  await admin.from("event_shirt_designs").delete().eq("event_id", event_id).eq("design_id", design_id);
  revalidatePath(`/admin/events/${event_id}/shirts`);
  redirect(`/admin/events/${event_id}/shirts?saved=removed`);
}

export async function saveShirtOrders(formData: FormData) {
  const current = await requireProfile();
  const event_id = String(formData.get("event_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? current.id);
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id,owner_profile_id").eq("id", profile_id).maybeSingle();
  if (!target || (current.role !== "admin" && target.id !== current.id && target.owner_profile_id !== current.id)) {
    redirect(`/events/${event_id}/shirts?error=${encodeURIComponent("You cannot manage that shirt order.")}`);
  }
  const { data: assigned } = await admin.from("event_attendees").select("id").eq("event_id", event_id).eq("profile_id", profile_id).maybeSingle();
  if (!assigned) redirect(`/events/${event_id}/shirts?error=${encodeURIComponent("That person is not assigned to this event.")}`);

  const { data: eventDesigns } = await admin.from("event_shirt_designs")
    .select("design_id").eq("event_id", event_id).eq("active", true);
  const designIds = (eventDesigns ?? []).map((row) => row.design_id);
  const { data: eventSizes } = designIds.length
    ? await admin.from("shirt_design_sizes").select("id").in("design_id", designIds).eq("active", true)
    : { data: [] };
  const allowed = new Set((eventSizes ?? []).map((size) => size.id));
  await admin.from("shirt_orders").delete().eq("event_id", event_id).eq("profile_id", profile_id);
  const orders = formData.getAll("quantity").map((value) => String(value)).map((value) => {
    const [design_size_id, quantityText] = value.split("|");
    return { design_size_id, quantity: Number(quantityText) };
  }).filter((row) => allowed.has(row.design_size_id) && Number.isInteger(row.quantity) && row.quantity > 0);
  if (orders.length) {
    const { error } = await admin.from("shirt_orders").insert(orders.map((row) => ({ ...row, event_id, profile_id })));
    if (error) redirect(`/events/${event_id}/shirts?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/events/${event_id}/shirts`);
  revalidatePath(`/admin/events/${event_id}/shirts`);
  redirect(`/events/${event_id}/shirts?saved=order`);
}

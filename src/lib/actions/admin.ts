"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const text = z.string().trim();

function parsePreferenceList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const eventSchema = z
  .object({
    name: text.min(1),
    start_date: text.min(1),
    end_date: text.min(1),
    location: text.min(1),
    description: text.default(""),
    status: z.enum(["draft", "upcoming", "active", "completed", "cancelled"])
  })
  .refine((event) => event.end_date >= event.start_date, {
    message: "End date must be the same as or later than the start date.",
    path: ["end_date"]
  });

const profileSchema = z.object({
  first_name: text.min(1),
  last_name: text.min(1),
  email: text.email(),
  password: z.string().min(6),
  role: z.enum(["admin", "attendee"]),
  phone: text.optional(),
  admin_notes: text.optional()
});

export async function createEvent(formData: FormData) {
  await requireAdmin();
  const submitted = Object.fromEntries(formData);
  const image = formData.get("image");
  const result = eventSchema.safeParse(submitted);

  if (!result.success) {
    const startDate = String(submitted.start_date ?? "(missing)");
    const endDate = String(submitted.end_date ?? "(missing)");
    const message = `${result.error.issues[0]?.message ?? "Invalid event details."} The server received start date ${startDate} and end date ${endDate}.`;
    redirect(`/admin/events/new?error=${encodeURIComponent(message)}`);
  }

  if (image instanceof File && image.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      redirect(`/admin/events/new?error=${encodeURIComponent("Upload a JPG, PNG, or WebP image.")}`);
    }

    if (image.size > 10 * 1024 * 1024) {
      redirect(`/admin/events/new?error=${encodeURIComponent("The event image must be 10 MB or smaller.")}`);
    }
  }

  const supabase = await createClient();
  const { data: createdEvent, error } = await supabase
    .from("events")
    .insert(result.data)
    .select("id")
    .single();

  if (error || !createdEvent) {
    const message =
      error?.code === "23514"
        ? `Supabase rejected the date order. The server received start date ${result.data.start_date} and end date ${result.data.end_date}.`
        : error?.message ?? "The event could not be created.";
    redirect(`/admin/events/new?error=${encodeURIComponent(message)}`);
  }

  if (image instanceof File && image.size > 0) {
    const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `events/${createdEvent.id}/cover-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(storagePath, image, {
        contentType: image.type,
        upsert: false
      });

    if (uploadError) {
      await supabase.from("events").delete().eq("id", createdEvent.id);
      redirect(`/admin/events/new?error=${encodeURIComponent(`The image could not be uploaded: ${uploadError.message}`)}`);
    }

    const { error: imageRecordError } = await supabase.from("event_images").insert({
      event_id: createdEvent.id,
      storage_path: storagePath,
      alt_text: String(formData.get("image_alt_text") ?? "").trim() || result.data.name,
      sort_order: 0
    });

    if (imageRecordError) {
      await supabase.storage.from("event-images").remove([storagePath]);
      await supabase.from("events").delete().eq("id", createdEvent.id);
      redirect(`/admin/events/new?error=${encodeURIComponent(`The image could not be attached to the event: ${imageRecordError.message}`)}`);
    }
  }

  revalidatePath("/");
  redirect("/admin/events");
}

export async function updateEvent(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = eventSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.from("events").update(parsed).eq("id", id);

  if (error) {
    redirect(`/admin/events/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/events");
  redirect(`/admin/events/${id}?saved=event`);
}

export async function createProfile(formData: FormData) {
  await requireAdmin();
  const parsed = profileSchema.parse(Object.fromEntries(formData));
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true
  });

  if (error || !data.user) {
    redirect(`/admin/users?error=${encodeURIComponent(error?.message ?? "Could not create user")}`);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    auth_user_id: data.user.id,
    owner_profile_id: null,
    first_name: parsed.first_name,
    last_name: parsed.last_name,
    email: parsed.email,
    role: parsed.role as Role,
    phone: parsed.phone || null,
    admin_notes: parsed.admin_notes || null,
    shirt_size_id: String(formData.get("shirt_size_id") ?? "") || null,
    allergies: parsePreferenceList(formData.get("allergies")),
    drink_preferences: parsePreferenceList(formData.get("drink_preferences")),
    snack_preferences: parsePreferenceList(formData.get("snack_preferences")),
    food_preferences: parsePreferenceList(formData.get("food_preferences")),
    comments: String(formData.get("comments") ?? "").trim() || null
  });

  if (profileError) {
    redirect(`/admin/users?error=${encodeURIComponent(profileError.message)}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=user");
}

export async function createDependentAsAdmin(formData: FormData) {
  await requireAdmin();
  const owner_profile_id = String(formData.get("owner_profile_id") ?? "");
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const admin = createAdminClient();

  if (!owner_profile_id || !first_name || !last_name) {
    redirect(`/admin/users?error=${encodeURIComponent("Choose a primary attendee and enter the dependent's name.")}`);
  }

  const { data: owner } = await admin
    .from("profiles")
    .select("id,role,owner_profile_id")
    .eq("id", owner_profile_id)
    .maybeSingle();

  if (!owner || owner.role !== "attendee" || owner.owner_profile_id) {
    redirect(`/admin/users?error=${encodeURIComponent("Dependents can only belong to a primary attendee account.")}`);
  }

  const shirt_size_id = String(formData.get("shirt_size_id") ?? "") || null;
  const { error } = await admin.from("profiles").insert({
    owner_profile_id,
    auth_user_id: null,
    first_name,
    last_name,
    email: null,
    role: "attendee",
    phone: null,
    shirt_size_id,
    allergies: parsePreferenceList(formData.get("allergies")),
    drink_preferences: parsePreferenceList(formData.get("drink_preferences")),
    snack_preferences: parsePreferenceList(formData.get("snack_preferences")),
    food_preferences: parsePreferenceList(formData.get("food_preferences")),
    comments: String(formData.get("comments") ?? "").trim() || null,
    admin_notes: String(formData.get("admin_notes") ?? "").trim() || null
  });

  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=dependent");
}

export async function deleteDependentAsAdmin(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const admin = createAdminClient();
  const { data: dependent } = await admin
    .from("profiles")
    .select("owner_profile_id")
    .eq("id", id)
    .maybeSingle();

  if (!dependent?.owner_profile_id) {
    redirect(`/admin/users?error=${encodeURIComponent("Only dependent profiles can be removed with this action.")}`);
  }

  const { error } = await admin.from("profiles").delete().eq("id", id);
  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=dependent-removed");
}

export async function updateProfile(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const admin = createAdminClient();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("auth_user_id,owner_profile_id")
    .eq("id", id)
    .maybeSingle();

  if (!existingProfile) {
    redirect(`/admin/users?error=${encodeURIComponent("Profile not found.")}`);
  }

  if (existingProfile.auth_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(existingProfile.auth_user_id, { email });
    if (authError) {
      redirect(`/admin/users?error=${encodeURIComponent(authError.message)}`);
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      email: existingProfile.auth_user_id ? email : null,
      role: existingProfile.owner_profile_id ? "attendee" : String(formData.get("role") ?? "attendee") as Role,
      phone: String(formData.get("phone") ?? "").trim() || null,
      admin_notes: String(formData.get("admin_notes") ?? "").trim() || null,
      shirt_size_id: String(formData.get("shirt_size_id") ?? "") || null,
      allergies: parsePreferenceList(formData.get("allergies")),
      drink_preferences: parsePreferenceList(formData.get("drink_preferences")),
      snack_preferences: parsePreferenceList(formData.get("snack_preferences")),
      food_preferences: parsePreferenceList(formData.get("food_preferences")),
      comments: String(formData.get("comments") ?? "").trim() || null
    })
    .eq("id", id);

  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  const shirt_size_id = String(formData.get("shirt_size_id") ?? "") || null;
  const { error: assignmentError } = await admin
    .from("event_attendees")
    .update({ shirt_size_id })
    .eq("profile_id", id);

  if (assignmentError) {
    redirect(`/admin/users?error=${encodeURIComponent(assignmentError.message)}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=profile");
}

export async function convertDependentToAccount(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const admin = createAdminClient();

  if (!email || password.length < 6) {
    redirect(`/admin/users?error=${encodeURIComponent("Enter an email and an initial password of at least 6 characters.")}`);
  }

  const { data: dependent } = await admin
    .from("profiles")
    .select("id,owner_profile_id,auth_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!dependent?.owner_profile_id || dependent.auth_user_id) {
    redirect(`/admin/users?error=${encodeURIComponent("Only a dependent can be converted to a login account.")}`);
  }

  const { data, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError || !data.user) {
    redirect(`/admin/users?error=${encodeURIComponent(authError?.message ?? "Could not create login account.")}`);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      auth_user_id: data.user.id,
      owner_profile_id: null,
      email
    })
    .eq("id", id);

  if (error) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?saved=converted");
}

export async function assignAttendee(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const profile_ids = formData
    .getAll("profile_ids")
    .map((value) => String(value))
    .filter(Boolean);
  const supabase = await createClient();

  if (profile_ids.length === 0) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("Choose at least one user.")}`);
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,shirt_size_id,owner_profile_id")
    .in("id", profile_ids);

  if (profileError) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(profileError.message)}`);
  }

  if (!profiles || profiles.length !== profile_ids.length || profiles.some((profile) => profile.owner_profile_id)) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("Dependents inherit event assignments from their primary attendee.")}`);
  }

  const { error } = await supabase
    .from("event_attendees")
    .insert(
      profiles.map((profile) => ({
        event_id,
        profile_id: profile.id,
        shirt_size_id: profile.shirt_size_id ?? null
      }))
    );

  if (error) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/events/${event_id}/attendees`);
  redirect(`/admin/events/${event_id}/attendees?saved=assigned`);
}

export async function updateAttendeeBed(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const attendee_id = String(formData.get("attendee_id") ?? "");
  const bed_id = String(formData.get("bed_id") ?? "") || null;
  const supabase = await createClient();

  const { data: attendee } = await supabase
    .from("event_attendees")
    .select("id,bed_id")
    .eq("id", attendee_id)
    .eq("event_id", event_id)
    .maybeSingle();

  if (!attendee) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("That attendee is not assigned to this event.")}`);
  }

  if (bed_id && bed_id !== attendee.bed_id) {
    const { data: bed } = await supabase
      .from("event_beds")
      .select("id,capacity")
      .eq("id", bed_id)
      .eq("event_id", event_id)
      .maybeSingle();

    if (!bed) {
      redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("That bed does not belong to this event.")}`);
    }

    const { count, error: countError } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("bed_id", bed_id);

    if (countError) {
      redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(countError.message)}`);
    }

    if ((count ?? 0) >= bed.capacity) {
      redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("That bed is already at capacity.")}`);
    }
  }

  const { error } = await supabase
    .from("event_attendees")
    .update({ bed_id })
    .eq("id", attendee_id)
    .eq("event_id", event_id);

  if (error) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/attendees`);
  revalidatePath(`/admin/events/${event_id}/beds`);
  redirect(`/admin/events/${event_id}/attendees?saved=bed`);
}

export async function updateAllAttendeeBeds(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const assignments = formData
    .getAll("bed_assignment")
    .map((value) => String(value))
    .map((value) => {
      const separator = value.indexOf("|");
      return {
        attendee_id: value.slice(0, separator),
        bed_id: value.slice(separator + 1) || null
      };
    })
    .filter((assignment) => assignment.attendee_id);
  const supabase = await createClient();

  const [{ data: attendees, error: attendeeError }, { data: beds, error: bedError }] = await Promise.all([
    supabase.from("event_attendees").select("id,bed_id").eq("event_id", event_id),
    supabase.from("event_beds").select("id,capacity").eq("event_id", event_id)
  ]);

  if (attendeeError || bedError) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(attendeeError?.message ?? bedError?.message ?? "Could not load bed assignments.")}`);
  }

  const attendeeRows = attendees ?? [];
  const bedRows = beds ?? [];
  const attendeeIds = new Set(attendeeRows.map((attendee) => attendee.id));
  const bedById = new Map(bedRows.map((bed) => [bed.id, bed]));
  const proposedByAttendee = new Map(assignments.map((assignment) => [assignment.attendee_id, assignment.bed_id]));

  if (proposedByAttendee.size !== attendeeRows.length || [...proposedByAttendee.keys()].some((id) => !attendeeIds.has(id))) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("The attendee list changed. Refresh the page and try again.")}`);
  }

  const proposedCounts = new Map<string, number>();
  for (const bed_id of proposedByAttendee.values()) {
    if (!bed_id) {
      continue;
    }
    if (!bedById.has(bed_id)) {
      redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent("One of the selected beds does not belong to this event.")}`);
    }
    proposedCounts.set(bed_id, (proposedCounts.get(bed_id) ?? 0) + 1);
  }

  for (const bed of bedRows) {
    const proposedCount = proposedCounts.get(bed.id) ?? 0;
    if (proposedCount > bed.capacity) {
      redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(`A selected bed has ${proposedCount} people assigned but only ${bed.capacity} spaces.`)}`);
    }
  }

  const changed = attendeeRows.filter(
    (attendee) => (proposedByAttendee.get(attendee.id) ?? null) !== attendee.bed_id
  );

  if (changed.length === 0) {
    redirect(`/admin/events/${event_id}/attendees?saved=bed`);
  }

  const changedIds = changed.map((attendee) => attendee.id);
  const { error: clearError } = await supabase
    .from("event_attendees")
    .update({ bed_id: null })
    .eq("event_id", event_id)
    .in("id", changedIds);

  if (clearError) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(clearError.message)}`);
  }

  const restorePreviousAssignments = async () => {
    await supabase
      .from("event_attendees")
      .update({ bed_id: null })
      .eq("event_id", event_id)
      .in("id", changedIds);

    for (const bed of bedRows) {
      const ids = changed.filter((attendee) => attendee.bed_id === bed.id).map((attendee) => attendee.id);
      if (ids.length) {
        await supabase.from("event_attendees").update({ bed_id: bed.id }).eq("event_id", event_id).in("id", ids);
      }
    }
  };

  for (const bed of bedRows) {
    const ids = changed
      .filter((attendee) => proposedByAttendee.get(attendee.id) === bed.id)
      .map((attendee) => attendee.id);
    if (!ids.length) {
      continue;
    }

    const { error } = await supabase
      .from("event_attendees")
      .update({ bed_id: bed.id })
      .eq("event_id", event_id)
      .in("id", ids);

    if (error) {
      await restorePreviousAssignments();
      redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/attendees`);
  revalidatePath(`/admin/events/${event_id}/beds`);
  redirect(`/admin/events/${event_id}/attendees?saved=beds`);
}

export async function createAndAssignAttendee(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const parsed = profileSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: "attendee",
    phone: formData.get("phone"),
    admin_notes: ""
  });

  if (!parsed.success) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid attendee details.")}`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true
  });

  if (error || !data.user) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(error?.message ?? "Could not create attendee.")}`);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    auth_user_id: data.user.id,
    owner_profile_id: null,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: parsed.data.email,
    role: "attendee",
    phone: parsed.data.phone || null,
    shirt_size_id: String(formData.get("shirt_size_id") ?? "") || null,
    allergies: parsePreferenceList(formData.get("allergies")),
    drink_preferences: parsePreferenceList(formData.get("drink_preferences")),
    snack_preferences: parsePreferenceList(formData.get("snack_preferences")),
    food_preferences: parsePreferenceList(formData.get("food_preferences")),
    comments: String(formData.get("comments") ?? "").trim() || null
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(profileError.message)}`);
  }

  const { error: assignmentError } = await admin.from("event_attendees").insert({
    event_id,
    profile_id: data.user.id,
    shirt_size_id: String(formData.get("shirt_size_id") ?? "") || null
  });

  if (assignmentError) {
    await admin.from("profiles").delete().eq("id", data.user.id);
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(assignmentError.message)}`);
  }

  revalidatePath(`/admin/events/${event_id}/attendees`);
  revalidatePath("/admin/users");
  redirect(`/admin/events/${event_id}/attendees?saved=created`);
}

export async function removeAttendee(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const event_id = String(formData.get("event_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("event_attendees").delete().eq("id", id);

  if (error) {
    redirect(`/admin/events/${event_id}/attendees?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/events/${event_id}/attendees`);
  redirect(`/admin/events/${event_id}/attendees?saved=removed`);
}

export async function createBed(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("event_beds").insert({
    event_id,
    name: String(formData.get("name") ?? "").trim(),
    bed_type: String(formData.get("bed_type") ?? "").trim() || null,
    capacity: Number(formData.get("capacity") ?? 1),
    sort_order: Number(formData.get("sort_order") ?? 0)
  });

  if (error) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/events/${event_id}/beds`);
  redirect(`/admin/events/${event_id}/beds?saved=bed`);
}

export async function updateBed(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const bed_id = String(formData.get("bed_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const bed_type = String(formData.get("bed_type") ?? "").trim() || null;
  const capacity = Number(formData.get("capacity") ?? 1);
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const supabase = await createClient();

  if (!name || !Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(sort_order)) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent("Enter a bed name, a whole-number capacity of at least 1, and a whole-number sort order.")}`);
  }

  const { count, error: countError } = await supabase
    .from("event_attendees")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event_id)
    .eq("bed_id", bed_id);

  if (countError) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(countError.message)}`);
  }

  if ((count ?? 0) > capacity) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(`That bed currently has ${count ?? 0} people assigned, so its capacity cannot be lower than ${count ?? 0}.`)}`);
  }

  const { error } = await supabase
    .from("event_beds")
    .update({ name, bed_type, capacity, sort_order })
    .eq("id", bed_id)
    .eq("event_id", event_id);

  if (error) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/beds`);
  redirect(`/admin/events/${event_id}/beds?saved=updated`);
}

export async function assignBed(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const attendee_id = String(formData.get("attendee_id") ?? "");
  const bed_id = String(formData.get("bed_id") ?? "") || null;
  const supabase = await createClient();

  if (bed_id) {
    const { data: bed } = await supabase.from("event_beds").select("capacity").eq("id", bed_id).single();
    const { count } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("bed_id", bed_id)
      .neq("id", attendee_id);

    if (bed && (count ?? 0) >= bed.capacity) {
      redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent("That bed is already at capacity.")}`);
    }
  }

  const { error } = await supabase.from("event_attendees").update({ bed_id }).eq("id", attendee_id);

  if (error) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/events/${event_id}/beds`);
  redirect(`/admin/events/${event_id}/beds?saved=assignment`);
}

export async function updateBedSlot(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const bed_id = String(formData.get("bed_id") ?? "");
  const current_attendee_id = String(formData.get("current_attendee_id") ?? "") || null;
  const selected_attendee_id = String(formData.get("selected_attendee_id") ?? "") || null;
  const supabase = await createClient();

  if (current_attendee_id === selected_attendee_id) {
    redirect(`/admin/events/${event_id}/beds?saved=assignment`);
  }

  const { data: bed } = await supabase
    .from("event_beds")
    .select("id,capacity")
    .eq("id", bed_id)
    .eq("event_id", event_id)
    .maybeSingle();

  if (!bed) {
    redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent("That bed does not belong to this event.")}`);
  }

  if (selected_attendee_id) {
    const { data: selectedAttendee } = await supabase
      .from("event_attendees")
      .select("id")
      .eq("id", selected_attendee_id)
      .eq("event_id", event_id)
      .maybeSingle();

    if (!selectedAttendee) {
      redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent("That attendee is not assigned to this event.")}`);
    }
  }

  if (current_attendee_id) {
    const { error: clearError } = await supabase
      .from("event_attendees")
      .update({ bed_id: null })
      .eq("id", current_attendee_id)
      .eq("event_id", event_id)
      .eq("bed_id", bed_id);

    if (clearError) {
      redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(clearError.message)}`);
    }
  }

  if (selected_attendee_id) {
    const { count } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("bed_id", bed_id);

    if ((count ?? 0) >= bed.capacity) {
      if (current_attendee_id) {
        await supabase
          .from("event_attendees")
          .update({ bed_id })
          .eq("id", current_attendee_id)
          .eq("event_id", event_id);
      }
      redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent("That bed is already at capacity.")}`);
    }

    const { error: assignError } = await supabase
      .from("event_attendees")
      .update({ bed_id })
      .eq("id", selected_attendee_id)
      .eq("event_id", event_id);

    if (assignError) {
      if (current_attendee_id) {
        await supabase
          .from("event_attendees")
          .update({ bed_id })
          .eq("id", current_attendee_id)
          .eq("event_id", event_id);
      }
      redirect(`/admin/events/${event_id}/beds?error=${encodeURIComponent(assignError.message)}`);
    }
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/beds`);
  redirect(`/admin/events/${event_id}/beds?saved=assignment`);
}

export async function upsertShirtSize(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const payload = {
    label: String(formData.get("label") ?? "").trim(),
    sort_order: Number(formData.get("sort_order") ?? 0),
    active: formData.get("active") === "on"
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("shirt_sizes").update(payload).eq("id", id)
    : supabase.from("shirt_sizes").insert(payload);
  const { error } = await query;

  if (error) {
    redirect(`/admin/shirt-sizes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/shirt-sizes");
  redirect("/admin/shirt-sizes?saved=size");
}

export async function addEventImage(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const supabase = await createClient();
  const file = formData.get("image");
  let storagePath = String(formData.get("storage_path") ?? "").trim();

  if (file instanceof File && file.size > 0) {
    const extension = file.name.split(".").pop() ?? "jpg";
    storagePath = `events/${event_id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent(uploadError.message)}`);
    }
  }

  if (!storagePath) {
    redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent("Upload an image or enter a storage path.")}`);
  }

  const { error } = await supabase.from("event_images").insert({
    event_id,
    storage_path: storagePath,
    alt_text: String(formData.get("alt_text") ?? "").trim() || null,
    sort_order: Number(formData.get("sort_order") ?? 0)
  });

  if (error) {
    redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/images`);
  redirect(`/admin/events/${event_id}/images?saved=image`);
}

export async function updateEventImage(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const image_id = String(formData.get("image_id") ?? "");
  const replacement = formData.get("image");
  const supabase = await createClient();

  const { data: existingImage } = await supabase
    .from("event_images")
    .select("id,storage_path")
    .eq("id", image_id)
    .eq("event_id", event_id)
    .maybeSingle();

  if (!existingImage) {
    redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent("Image not found.")}`);
  }

  let storagePath = existingImage.storage_path;
  let uploadedPath: string | null = null;

  if (replacement instanceof File && replacement.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(replacement.type)) {
      redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent("Upload a JPG, PNG, or WebP image.")}`);
    }
    if (replacement.size > 10 * 1024 * 1024) {
      redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent("The event image must be 10 MB or smaller.")}`);
    }

    const extension = replacement.name.split(".").pop()?.toLowerCase() || "jpg";
    uploadedPath = `events/${event_id}/${Date.now()}-${image_id}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(uploadedPath, replacement, {
        contentType: replacement.type,
        upsert: false
      });

    if (uploadError) {
      redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent(uploadError.message)}`);
    }
    storagePath = uploadedPath;
  }

  const { error } = await supabase
    .from("event_images")
    .update({
      storage_path: storagePath,
      alt_text: String(formData.get("alt_text") ?? "").trim() || null,
      sort_order: Number(formData.get("sort_order") ?? 0)
    })
    .eq("id", image_id)
    .eq("event_id", event_id);

  if (error) {
    if (uploadedPath) {
      await supabase.storage.from("event-images").remove([uploadedPath]);
    }
    redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent(error.message)}`);
  }

  if (uploadedPath && existingImage.storage_path !== uploadedPath) {
    const { count } = await supabase
      .from("event_images")
      .select("id", { count: "exact", head: true })
      .eq("storage_path", existingImage.storage_path);
    if ((count ?? 0) === 0) {
      await supabase.storage.from("event-images").remove([existingImage.storage_path]);
    }
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/images`);
  redirect(`/admin/events/${event_id}/images?saved=updated`);
}

export async function deleteEventImage(formData: FormData) {
  await requireAdmin();
  const event_id = String(formData.get("event_id") ?? "");
  const image_id = String(formData.get("image_id") ?? "");
  const supabase = await createClient();

  const { data: existingImage } = await supabase
    .from("event_images")
    .select("id,storage_path")
    .eq("id", image_id)
    .eq("event_id", event_id)
    .maybeSingle();

  if (!existingImage) {
    redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent("Image not found.")}`);
  }

  const { error } = await supabase
    .from("event_images")
    .delete()
    .eq("id", image_id)
    .eq("event_id", event_id);

  if (error) {
    redirect(`/admin/events/${event_id}/images?error=${encodeURIComponent(error.message)}`);
  }

  const { count } = await supabase
    .from("event_images")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", existingImage.storage_path);
  if ((count ?? 0) === 0) {
    await supabase.storage.from("event-images").remove([existingImage.storage_path]);
  }

  revalidatePath("/");
  revalidatePath(`/admin/events/${event_id}/images`);
  redirect(`/admin/events/${event_id}/images?saved=deleted`);
}

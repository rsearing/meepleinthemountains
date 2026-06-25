"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

function parsePreferenceList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requireManagedProfile(profileId: string) {
  const owner = await requireProfile();
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id,owner_profile_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!target || (target.id !== owner.id && target.owner_profile_id !== owner.id)) {
    throw new Error("You cannot manage that participant.");
  }

  return { owner, admin, target };
}

export async function updateOwnProfile(formData: FormData) {
  const profile = await requireProfile();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const shirt_size_id = String(formData.get("shirt_size_id") ?? "") || null;
  const allergies = parsePreferenceList(formData.get("allergies"));
  const drink_preferences = parsePreferenceList(formData.get("drink_preferences"));
  const snack_preferences = parsePreferenceList(formData.get("snack_preferences"));
  const food_preferences = parsePreferenceList(formData.get("food_preferences"));
  const comments = String(formData.get("comments") ?? "").trim() || null;

  if (!first_name || !last_name || !email) {
    redirect(`/account?error=${encodeURIComponent("First name, last name, and email are required.")}`);
  }

  const admin = createAdminClient();
  if (!profile.auth_user_id) {
    redirect(`/account?error=${encodeURIComponent("This profile does not have a login account.")}`);
  }

  const { error: authError } = await admin.auth.admin.updateUserById(profile.auth_user_id, { email });

  if (authError) {
    redirect(`/account?error=${encodeURIComponent(authError.message)}`);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      first_name,
      last_name,
      email,
      phone,
      shirt_size_id,
      allergies,
      drink_preferences,
      snack_preferences,
      food_preferences,
      comments
    })
    .eq("id", profile.id);

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  const { error: assignmentError } = await admin
    .from("event_attendees")
    .update({ shirt_size_id })
    .eq("profile_id", profile.id);

  if (assignmentError) {
    redirect(`/account?error=${encodeURIComponent(assignmentError.message)}`);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  redirect("/account?saved=profile");
}

export async function createDependent(formData: FormData) {
  const owner = await requireProfile();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();

  if (owner.role !== "attendee" || !first_name || !last_name) {
    redirect(`/account?error=${encodeURIComponent("Enter a first and last name for the dependent.")}`);
  }

  const admin = createAdminClient();
  const shirt_size_id = String(formData.get("shirt_size_id") ?? "") || null;
  const { error } = await admin.from("profiles").insert({
    owner_profile_id: owner.id,
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
    comments: String(formData.get("comments") ?? "").trim() || null
  });

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  redirect("/account?saved=dependent");
}

export async function updateDependent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { admin } = await requireManagedProfile(id);
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const shirt_size_id = String(formData.get("shirt_size_id") ?? "") || null;

  if (!first_name || !last_name) {
    redirect(`/account?error=${encodeURIComponent("First and last name are required.")}`);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      first_name,
      last_name,
      shirt_size_id,
      allergies: parsePreferenceList(formData.get("allergies")),
      drink_preferences: parsePreferenceList(formData.get("drink_preferences")),
      snack_preferences: parsePreferenceList(formData.get("snack_preferences")),
      food_preferences: parsePreferenceList(formData.get("food_preferences")),
      comments: String(formData.get("comments") ?? "").trim() || null
    })
    .eq("id", id);

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  const { error: assignmentError } = await admin
    .from("event_attendees")
    .update({ shirt_size_id })
    .eq("profile_id", id);

  if (assignmentError) {
    redirect(`/account?error=${encodeURIComponent(assignmentError.message)}`);
  }

  revalidatePath("/account");
  redirect("/account?saved=dependent");
}

export async function deleteDependent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { admin, target } = await requireManagedProfile(id);

  if (!target.owner_profile_id) {
    redirect(`/account?error=${encodeURIComponent("Only dependent profiles can be removed here.")}`);
  }

  const { error } = await admin.from("profiles").delete().eq("id", id);
  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  redirect("/account?saved=dependent-removed");
}

export async function addGameRequest(formData: FormData) {
  const profile = await requireProfile();
  const event_id = String(formData.get("event_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? profile.id);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Enter a game title.")}`);
  }
  const { admin } = await requireManagedProfile(profile_id);
  const { data: assignment } = await admin
    .from("event_attendees")
    .select("id")
    .eq("event_id", event_id)
    .eq("profile_id", profile_id)
    .maybeSingle();

  if (!assignment) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("That participant is not part of this event.")}`);
  }

  const { error } = await admin.from("game_requests").insert({
    event_id,
    profile_id,
    title,
    notes: String(formData.get("notes") ?? "").trim() || null
  });

  if (error) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/events/${event_id}/games`);
  revalidatePath(`/events/${event_id}`);
  redirect(`/events/${event_id}/games?saved=request`);
}

export async function addGameBrought(formData: FormData) {
  const profile = await requireProfile();
  const event_id = String(formData.get("event_id") ?? "");
  const profile_id = String(formData.get("profile_id") ?? profile.id);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Enter a game title.")}`);
  }
  const { admin } = await requireManagedProfile(profile_id);
  const { data: assignment } = await admin
    .from("event_attendees")
    .select("id")
    .eq("event_id", event_id)
    .eq("profile_id", profile_id)
    .maybeSingle();

  if (!assignment) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("That participant is not part of this event.")}`);
  }

  const { error } = await admin.from("games_brought").insert({
    event_id,
    profile_id,
    title,
    notes: String(formData.get("notes") ?? "").trim() || null
  });

  if (error) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/events/${event_id}/games`);
  revalidatePath(`/events/${event_id}`);
  revalidatePath("/");
  redirect(`/events/${event_id}/games?saved=brought`);
}

export async function updateGameEntry(formData: FormData) {
  const event_id = String(formData.get("event_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const table = String(formData.get("table") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (table !== "game_requests" && table !== "games_brought") {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Invalid game entry.")}`);
  }

  if (!title) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Enter a game title.")}`);
  }

  const admin = createAdminClient();
  const { data: entry } = await admin.from(table).select("profile_id").eq("id", id).maybeSingle();
  if (!entry) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Game entry not found.")}`);
  }

  await requireManagedProfile(entry.profile_id);
  const { error } = await admin.from(table).update({ title, notes }).eq("id", id);
  if (error) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/events/${event_id}/games`);
  revalidatePath(`/events/${event_id}`);
  if (table === "games_brought") {
    revalidatePath("/");
  }
  redirect(`/events/${event_id}/games?saved=updated`);
}

export async function deleteGameEntry(formData: FormData) {
  const event_id = String(formData.get("event_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const table = String(formData.get("table") ?? "");

  if (table !== "game_requests" && table !== "games_brought") {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Invalid game entry.")}`);
  }

  const admin = createAdminClient();
  const { data: entry } = await admin.from(table).select("profile_id").eq("id", id).maybeSingle();

  if (!entry) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent("Game entry not found.")}`);
  }

  await requireManagedProfile(entry.profile_id);
  const { error } = await admin.from(table).delete().eq("id", id);

  if (error) {
    redirect(`/events/${event_id}/games?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/events/${event_id}/games`);
  revalidatePath(`/events/${event_id}`);
  if (table === "games_brought") {
    revalidatePath("/");
  }
  redirect(`/events/${event_id}/games?saved=deleted`);
}

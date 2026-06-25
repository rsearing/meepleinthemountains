import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, auth_user_id, owner_profile_id, first_name, last_name, email, role, phone, admin_notes, shirt_size_id, allergies, drink_preferences, snack_preferences, food_preferences, comments"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data as Profile | null;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }
  return profile;
}

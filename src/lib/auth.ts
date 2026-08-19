import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const profileFields =
  "id, auth_user_id, owner_profile_id, first_name, last_name, email, role, phone, admin_notes, shirt_size_id, allergies, drink_preferences, snack_preferences, food_preferences, comments";

export async function getAuthenticatedProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select(profileFields)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data as Profile | null;
}

export async function getAuthContext() {
  const authenticatedProfile = await getAuthenticatedProfile();
  let profile = authenticatedProfile;
  let isImpersonating = false;

  if (authenticatedProfile?.role === "admin") {
    const cookieStore = await cookies();
    const impersonatedProfileId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

    if (impersonatedProfileId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("profiles")
        .select(profileFields)
        .eq("id", impersonatedProfileId)
        .eq("role", "attendee")
        .is("owner_profile_id", null)
        .not("auth_user_id", "is", null)
        .maybeSingle();

      if (data) {
        profile = data as Profile;
        isImpersonating = true;
      }
    }
  }

  return { authenticatedProfile, profile, isImpersonating };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  return (await getAuthContext()).profile;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

export async function requireAdmin() {
  const profile = await getAuthenticatedProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }
  return profile;
}

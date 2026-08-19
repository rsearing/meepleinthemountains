"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { createAdminClient } from "@/lib/supabase/server";

export async function startImpersonating(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profile_id") ?? "");
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("role", "attendee")
    .is("owner_profile_id", null)
    .not("auth_user_id", "is", null)
    .maybeSingle();

  if (!target) {
    redirect(`/admin/users?error=${encodeURIComponent("Choose an attendee with a login account.")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4
  });

  redirect("/dashboard");
}

export async function stopImpersonating() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/admin/users");
}


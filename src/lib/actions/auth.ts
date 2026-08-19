"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/");
}

export async function updatePassword(formData: FormData) {
  const { isImpersonating } = await getAuthContext();
  if (isImpersonating) {
    redirect(`/account?error=${encodeURIComponent("Exit user view before changing a password.")}`);
  }

  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/account?saved=password");
}

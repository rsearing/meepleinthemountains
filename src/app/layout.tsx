import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Board Games with Rob Events",
  description: "Board gaming retreats and event management from Board Games with Rob"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile();

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link className="brand" href="/">
              Board Games with Rob Events
            </Link>
            <nav className="nav" aria-label="Main navigation">
              <Link href="/">Events</Link>
              {profile ? (
                <>
                  <Link href="/dashboard">My Events</Link>
                  <Link href="/account">My Account</Link>
                  {profile.role === "admin" ? <Link href="/admin">Admin</Link> : null}
                  <form action={logout}>
                    <button className="link-button" type="submit">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login">Log in</Link>
              )}
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

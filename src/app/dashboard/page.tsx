import Link from "next/link";
import { updatePassword } from "@/lib/actions/auth";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/format";

type AssignedEventRow = {
  id: string;
  events: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    location: string;
    description: string;
    status: string;
  } | null;
  event_beds: { name: string } | null;
};

type DependentBedRow = {
  event_id: string;
  event_beds: { name: string } | null;
  profiles: { id: string; first_name: string; last_name: string } | null;
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const params = (await searchParams) ?? {};
  const saved = typeof params.saved === "string" ? params.saved : null;
  const error = typeof params.error === "string" ? params.error : null;
  const supabase = await createClient();
  const [{ data }, { data: dependentData }] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("id, events(id,name,start_date,end_date,location,description,status), event_beds(name)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id").eq("owner_profile_id", profile.id)
  ]);

  const assignedEvents = (data ?? []) as unknown as AssignedEventRow[];
  const dependentIds = (dependentData ?? []).map((dependent) => dependent.id);
  const { data: dependentBedData } = dependentIds.length
    ? await supabase
        .from("event_attendees")
        .select("event_id,event_beds(name),profiles(id,first_name,last_name)")
        .in("profile_id", dependentIds)
    : { data: [] };
  const dependentBeds = (dependentBedData ?? []) as unknown as DependentBedRow[];

  return (
    <section className="grid">
      <div className="page-title">
        <h1>My Events</h1>
        <p>Welcome, {profile.first_name}. Choose an event to see attendees and manage game lists.</p>
      </div>
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="panel account-prompt">
        <div>
          <h2>My Preferences</h2>
          <p className="muted">
            Add or update your shirt size, allergies, drinks, snacks, food preferences, contact details, and comments.
          </p>
        </div>
        <Link className="button" href="/account">
          Update my account
        </Link>
      </div>

      <div className="grid two">
        {assignedEvents.length === 0 ? (
          <div className="panel">
            <h2>No assigned events</h2>
            <p className="muted">The organizer has not assigned you to an event yet.</p>
          </div>
        ) : (
          assignedEvents.map((row) =>
            row.events ? (
              <article className="card" key={row.id}>
                <span className={`status ${row.events.status}`}>{row.events.status}</span>
                <h2>{row.events.name}</h2>
                <p className="muted">
                  {formatDateRange(row.events.start_date, row.events.end_date)} at {row.events.location}
                </p>
                <p>{row.events.description}</p>
                <p>
                  <strong>Your bed:</strong> {row.event_beds?.name ?? "Not assigned yet"}
                </p>
                {dependentBeds
                  .filter((dependent) => dependent.event_id === row.events?.id)
                  .map((dependent) => (
                    <p key={`${row.id}-dependent-${dependent.profiles?.id ?? "unknown"}`}>
                      <strong>
                        {dependent.profiles
                          ? `${dependent.profiles.first_name} ${dependent.profiles.last_name}`
                          : "Dependent"}:
                      </strong>{" "}
                      {dependent.event_beds?.name ?? "Not assigned yet"}
                    </p>
                  ))}
                <div className="actions">
                  <Link className="button" href={`/events/${row.events.id}`}>
                    View event
                  </Link>
                </div>
              </article>
            ) : null
          )
        )}
      </div>

      <form className="panel form" action={updatePassword}>
        <h2>Change Password</h2>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" minLength={6} required />
        </div>
        <button className="button" type="submit">
          Update password
        </button>
      </form>
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { availableBedSlots, formatDateRange, privateDisplayName } from "@/lib/format";

type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  owner_profile_id: string | null;
};

type GameRow = {
  id: string;
  title: string;
  notes: string | null;
  profile_id: string;
  profiles: Participant | null;
};

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  const profile = await requireProfile();
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("event_attendees")
    .select("id,event_beds(name),events(id,name,start_date,end_date,location,description,status,event_beds(capacity),event_attendees(id))")
    .eq("event_id", eventId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!assignment?.events && profile.role !== "admin") {
    notFound();
  }

  const admin = createAdminClient();
  const [{ data: event }, { data: attendees }, { data: brought }, { data: requests }] = await Promise.all([
    admin
      .from("events")
      .select("id,name,start_date,end_date,location,description,status,event_beds(id,capacity),event_attendees(id,bed_id)")
      .eq("id", eventId)
      .maybeSingle(),
    admin
      .from("event_attendees")
      .select("id,profiles(id,first_name,last_name,owner_profile_id)")
      .eq("event_id", eventId)
      .order("created_at"),
    admin
      .from("games_brought")
      .select("id,title,notes,profile_id,profiles(id,first_name,last_name,owner_profile_id)")
      .eq("event_id", eventId)
      .order("title"),
    admin
      .from("game_requests")
      .select("id,title,notes,profile_id,profiles(id,first_name,last_name,owner_profile_id)")
      .eq("event_id", eventId)
      .order("title")
  ]);

  if (!event) {
    notFound();
  }

  const attendeeProfiles = (attendees ?? [])
    .map((row) => row.profiles as unknown as Participant | null)
    .filter((entry): entry is Participant => Boolean(entry))
    .sort((a, b) => privateDisplayName(a).localeCompare(privateDisplayName(b)));
  const assignedProfileIds = new Set(attendeeProfiles.map((attendee) => attendee.id));
  const broughtRows = ((brought ?? []) as unknown as GameRow[]).filter((row) =>
    assignedProfileIds.has(row.profile_id)
  );
  const requestRows = ((requests ?? []) as unknown as GameRow[]).filter((row) =>
    assignedProfileIds.has(row.profile_id)
  );
  const totalBeds = event.event_beds.reduce((sum, bed) => sum + bed.capacity, 0);
  const assignedCount = event.event_attendees.length;
  const available = availableBedSlots(event.event_beds, event.event_attendees);

  return (
    <section className="grid">
      <div className="page-title">
        <h1>{event.name}</h1>
        <p>{formatDateRange(event.start_date, event.end_date)} at {event.location}</p>
      </div>

      <div className="grid three">
        <div className="metric">
          <strong>{available}</strong>
          Beds available
        </div>
        <div className="metric">
          <strong>{assignedCount}</strong>
          Attendees assigned
        </div>
        <div className="metric">
          <strong>{totalBeds}</strong>
          Total bed slots
        </div>
      </div>

      <div className="panel">
        <p>{event.description}</p>
        {assignment ? (
          <p>
            <strong>Your bed:</strong>{" "}
            {(assignment.event_beds as unknown as { name: string } | null)?.name ?? "Not assigned yet"}
          </p>
        ) : null}
        <Link className="button" href={`/events/${event.id}/games`}>
          Manage my game lists
        </Link>
        {" "}
        <Link className="button secondary" href={`/events/${event.id}/shirts`}>
          Choose shirts
        </Link>
      </div>

      <div className="panel attendee-name-list">
        <h2>Attendees</h2>
        {attendeeProfiles.length ? (
          <ul className="two-column-list">
            {attendeeProfiles.map((attendee) => (
              <li key={attendee.id}>
                {privateDisplayName(attendee)}
                {attendee.owner_profile_id ? " (Dependent)" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No attendees assigned yet.</p>
        )}
      </div>

      <div className="grid two shared-game-sections">
        <SharedGameList title="Games Being Brought" rows={broughtRows} />
        <SharedGameList title="Game Wishlist" rows={requestRows} />
      </div>
    </section>
  );
}

function SharedGameList({ title, rows }: { title: string; rows: GameRow[] }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">No games listed yet.</p>
      ) : (
        <ul className="game-entry-list">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>{row.title}</strong>
              <span>
                {row.profiles ? privateDisplayName(row.profiles) : "Unknown"}
                {row.profiles?.owner_profile_id ? " (Dependent)" : ""}
              </span>
              {row.notes ? <small>{row.notes}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

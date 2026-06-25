import { addGameBrought, addGameRequest, deleteGameEntry, updateGameEntry } from "@/lib/actions/attendee";
import { requireProfile } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fullName, privateDisplayName } from "@/lib/format";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EventAdminNav } from "@/components/event-admin-nav";

type GameRow = {
  id: string;
  title: string;
  notes: string | null;
  profile_id: string;
  profiles: { first_name: string; last_name: string; owner_profile_id: string | null } | null;
};

type ManagedProfile = {
  id: string;
  first_name: string;
  last_name: string;
  owner_profile_id: string | null;
};

export default async function GamesPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const { eventId } = await params;
  const paramsValue = (await searchParams) ?? {};
  const saved = typeof paramsValue.saved === "string" ? paramsValue.saved : null;
  const error = typeof paramsValue.error === "string" ? paramsValue.error : null;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("event_attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!assignment && profile.role !== "admin") {
    notFound();
  }

  const admin = createAdminClient();
  const [{ data: requests }, { data: brought }, { data: dependentData }, { data: allRequests }, { data: allBrought }, { data: eventAttendees }] = await Promise.all([
    admin
      .from("game_requests")
      .select("id,title,notes,profile_id,profiles(first_name,last_name,owner_profile_id)")
      .eq("event_id", eventId)
      .order("title"),
    admin
      .from("games_brought")
      .select("id,title,notes,profile_id,profiles(first_name,last_name,owner_profile_id)")
      .eq("event_id", eventId)
      .order("title"),
    admin
      .from("profiles")
      .select("id,first_name,last_name,owner_profile_id")
      .eq("owner_profile_id", profile.id)
      .order("last_name"),
    admin.from("game_requests").select("title").order("title"),
    admin.from("games_brought").select("title").order("title"),
    admin.from("event_attendees").select("profile_id").eq("event_id", eventId)
  ]);
  const managedProfiles: ManagedProfile[] = [
    { id: profile.id, first_name: profile.first_name, last_name: profile.last_name, owner_profile_id: null },
    ...((dependentData ?? []) as ManagedProfile[])
  ];
  const managedProfileIds = new Set(managedProfiles.map((entry) => entry.id));
  const assignedProfileIds = new Set((eventAttendees ?? []).map((entry) => entry.profile_id));
  const visibleRequests = ((requests ?? []) as unknown as GameRow[]).filter((row) =>
    assignedProfileIds.has(row.profile_id)
  );
  const visibleBrought = ((brought ?? []) as unknown as GameRow[]).filter((row) =>
    assignedProfileIds.has(row.profile_id)
  );
  const myRequests = visibleRequests.filter((row) => managedProfileIds.has(row.profile_id));
  const myBrought = visibleBrought.filter((row) => managedProfileIds.has(row.profile_id));
  const titleSuggestions = [...new Set(
    [...(allRequests ?? []), ...(allBrought ?? [])]
      .map((entry) => entry.title.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Manage My Game Lists</h1>
        <p>Add one game per entry for yourself or a dependent.</p>
        <Link href={`/events/${eventId}`}>Back to shared event view</Link>
      </div>
      {profile.role === "admin" ? <EventAdminNav eventId={eventId} current="games" /> : null}
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="grid two">
        <form className="panel form" action={addGameRequest}>
          <h2>Add to Wishlist</h2>
          <input type="hidden" name="event_id" value={eventId} />
          <PersonField profiles={managedProfiles} name="request-profile" />
          <div className="field">
            <label htmlFor="request-title">Game title</label>
            <input id="request-title" name="title" list="game-title-suggestions" required />
          </div>
          <div className="field">
            <label htmlFor="request-notes">Notes</label>
            <textarea id="request-notes" name="notes" />
          </div>
          <button className="button" type="submit">
            Add wishlist game
          </button>
        </form>

        <form className="panel form" action={addGameBrought}>
          <h2>Add to Inventory</h2>
          <input type="hidden" name="event_id" value={eventId} />
          <PersonField profiles={managedProfiles} name="brought-profile" />
          <div className="field">
            <label htmlFor="brought-title">Game title</label>
            <input id="brought-title" name="title" list="game-title-suggestions" required />
          </div>
          <div className="field">
            <label htmlFor="brought-notes">Notes</label>
            <textarea id="brought-notes" name="notes" />
          </div>
          <button className="button" type="submit">
            Add game
          </button>
        </form>
      </div>

      <datalist id="game-title-suggestions">
        {titleSuggestions.map((title) => <option key={title} value={title} />)}
      </datalist>

      <div className="page-title compact">
        <h2>My Games</h2>
        <p>Edit or remove entries for yourself and your dependents.</p>
      </div>
      <div className="grid two">
        <EditableGameList title="My Wishlist" rows={myRequests} table="game_requests" eventId={eventId} />
        <EditableGameList title="My Games Being Brought" rows={myBrought} table="games_brought" eventId={eventId} />
      </div>

      <div className="page-title compact">
        <h2>Everyone&apos;s Game Lists</h2>
        <p>Shared event lists are shown below for reference.</p>
      </div>
      <GameTable title="Wishlist" rows={visibleRequests} />
      <GameTable title="Games Being Brought" rows={visibleBrought} />
    </section>
  );
}

function PersonField({ profiles, name }: { profiles: ManagedProfile[]; name: string }) {
  return (
    <div className="field">
      <label htmlFor={name}>For</label>
      <select id={name} name="profile_id">
        {profiles.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {fullName(entry)}{entry.owner_profile_id ? " (Dependent)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function EditableGameList({
  title,
  rows,
  table,
  eventId
}: {
  title: string;
  rows: GameRow[];
  table: "game_requests" | "games_brought";
  eventId: string;
}) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="muted">No entries yet.</p> : null}
      <div className="game-edit-list">
        {rows.map((row) => (
          <div className="game-edit-row" key={row.id}>
            <form className="form" action={updateGameEntry}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="table" value={table} />
              <div className="field">
                <label htmlFor={`title-${table}-${row.id}`}>Game title</label>
                <input
                  id={`title-${table}-${row.id}`}
                  name="title"
                  defaultValue={row.title}
                  list="game-title-suggestions"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`notes-${table}-${row.id}`}>Notes</label>
                <input id={`notes-${table}-${row.id}`} name="notes" defaultValue={row.notes ?? ""} />
              </div>
              <p className="muted">
                For {row.profiles ? fullName(row.profiles) : "Unknown"}
                {row.profiles?.owner_profile_id ? " (Dependent)" : ""}
              </p>
              <button className="button secondary" type="submit">Save changes</button>
            </form>
            <form action={deleteGameEntry}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="table" value={table} />
              <button className="button danger" type="submit">Delete</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameTable({ title, rows }: { title: string; rows: GameRow[] }) {
  return (
    <div className="panel table-wrap">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Person</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3}>No entries yet.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}</td>
              <td>
                {row.profiles ? privateDisplayName(row.profiles) : "Unknown"}
                {row.profiles?.owner_profile_id ? " (Dependent)" : ""}
              </td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

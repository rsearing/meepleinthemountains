import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/format";

type ReportRow = {
  id: string;
  food_allergies: string | null;
  food_preferences: string | null;
  profiles: { first_name: string; last_name: string; email: string | null; owner_profile_id: string | null } | null;
  events: { name: string } | null;
  shirt_sizes: { label: string } | null;
  event_beds: { name: string } | null;
};

type GameReportRow = {
  id: string;
  title: string;
  notes: string | null;
  profiles: { first_name: string; last_name: string; owner_profile_id: string | null } | null;
  events: { name: string } | null;
};

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: attendees }, { data: requests }, { data: brought }] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("id,food_allergies,food_preferences,profiles(first_name,last_name,email,owner_profile_id),events(name),shirt_sizes(label),event_beds(name)")
      .order("created_at", { ascending: false }),
    supabase.from("game_requests").select("id,title,notes,profiles(first_name,last_name,owner_profile_id),events(name)").order("title"),
    supabase.from("games_brought").select("id,title,notes,profiles(first_name,last_name,owner_profile_id),events(name)").order("title")
  ]);

  const attendeeRows = (attendees ?? []) as unknown as ReportRow[];
  const requestRows = (requests ?? []) as unknown as GameReportRow[];
  const broughtRows = (brought ?? []) as unknown as GameReportRow[];
  const shirtCounts = attendeeRows.reduce<Record<string, number>>((counts, row) => {
    const label = row.shirt_sizes?.label ?? "Not selected";
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Reports</h1>
        <p>Review attendee preferences, shirt counts, bed assignments, and game lists.</p>
      </div>

      <div className="panel">
        <h2>Shirt Size Counts</h2>
        <div className="grid three">
          {Object.entries(shirtCounts).map(([label, count]) => (
            <div className="metric" key={label}>
              <strong>{count}</strong>
              {label}
            </div>
          ))}
        </div>
      </div>

      <ReportTable rows={attendeeRows} />
      <GameReport title="Requested Games" rows={requestRows} />
      <GameReport title="Games Being Brought" rows={broughtRows} />
    </section>
  );
}

function ReportTable({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="panel table-wrap">
      <h2>Attendee Report</h2>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Attendee</th>
            <th>Email</th>
            <th>Shirt</th>
            <th>Bed</th>
            <th>Food allergies</th>
            <th>Food preferences</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.events?.name}</td>
              <td>
                {row.profiles ? fullName(row.profiles) : "Unknown"}
                {row.profiles?.owner_profile_id ? " (Dependent)" : ""}
              </td>
              <td>{row.profiles?.email ?? "-"}</td>
              <td>{row.shirt_sizes?.label ?? "Not selected"}</td>
              <td>{row.event_beds?.name ?? "Not assigned"}</td>
              <td>{row.food_allergies}</td>
              <td>{row.food_preferences}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameReport({ title, rows }: { title: string; rows: GameReportRow[] }) {
  return (
    <div className="panel table-wrap">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Title</th>
            <th>Person</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.events?.name}</td>
              <td>{row.title}</td>
              <td>
                {row.profiles ? fullName(row.profiles) : "Unknown"}
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

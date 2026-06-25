import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EventAdminNav } from "@/components/event-admin-nav";

type PlanningAttendee = {
  id: string;
  profiles: {
    first_name: string;
    last_name: string;
    owner_profile_id: string | null;
    allergies: string[];
    snack_preferences: string[];
    food_preferences: string[];
    shirt_sizes: { label: string } | null;
  } | null;
};

type GroupedPreference = {
  label: string;
  names: string[];
};

function groupPreferences(
  attendees: PlanningAttendee[],
  field: "allergies" | "snack_preferences" | "food_preferences"
) {
  const grouped = new Map<string, GroupedPreference>();

  for (const attendee of attendees) {
    if (!attendee.profiles) {
      continue;
    }

    const name = fullName(attendee.profiles);
    for (const value of attendee.profiles[field] ?? []) {
      const label = value.trim();
      const key = label.toLocaleLowerCase();

      if (!label) {
        continue;
      }

      const entry = grouped.get(key) ?? { label, names: [] };
      if (!entry.names.includes(name)) {
        entry.names.push(name);
      }
      grouped.set(key, entry);
    }
  }

  return [...grouped.values()]
    .map((entry) => ({ ...entry, names: entry.names.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default async function EventPlanningReportPage({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdmin();
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: attendees }] = await Promise.all([
    supabase.from("events").select("id,name").eq("id", eventId).maybeSingle(),
    supabase
      .from("event_attendees")
      .select(
        "id,profiles(first_name,last_name,owner_profile_id,allergies,snack_preferences,food_preferences,shirt_sizes(label))"
      )
      .eq("event_id", eventId)
      .order("created_at")
  ]);

  if (!event) {
    notFound();
  }

  const attendeeRows = (attendees ?? []) as unknown as PlanningAttendee[];
  const allergies = groupPreferences(attendeeRows, "allergies");
  const snacks = groupPreferences(attendeeRows, "snack_preferences");
  const foods = groupPreferences(attendeeRows, "food_preferences");

  return (
    <section className="grid">
      <div className="page-title">
        <h1>{event.name} Planning Report</h1>
        <p>Shirt sizes and shared food-planning preferences for assigned attendees.</p>
      </div>
      <EventAdminNav eventId={eventId} current="reports" />

      <div className="panel table-wrap">
        <h2>Shirt Sizes</h2>
        <table>
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Shirt size</th>
            </tr>
          </thead>
          <tbody>
            {attendeeRows.length === 0 ? (
              <tr>
                <td colSpan={2}>No attendees assigned.</td>
              </tr>
            ) : (
              attendeeRows.map((attendee) => (
                <tr key={attendee.id}>
                  <td>
                    {attendee.profiles ? fullName(attendee.profiles) : "Unknown"}
                    {attendee.profiles?.owner_profile_id ? " (Dependent)" : ""}
                  </td>
                  <td>{attendee.profiles?.shirt_sizes?.label ?? "Not selected"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid three planning-reports">
        <PreferenceReport title="Allergies" itemLabel="Allergy" rows={allergies} />
        <PreferenceReport title="Snack Preferences" itemLabel="Snack" rows={snacks} />
        <PreferenceReport title="Food Preferences" itemLabel="Food" rows={foods} />
      </div>
    </section>
  );
}

function PreferenceReport({
  title,
  itemLabel,
  rows
}: {
  title: string;
  itemLabel: string;
  rows: GroupedPreference[];
}) {
  return (
    <div className="panel table-wrap">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>{itemLabel}</th>
            <th>People</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2}>None listed.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.label.toLocaleLowerCase()}>
                <td>{row.label}</td>
                <td>{row.names.join(", ")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

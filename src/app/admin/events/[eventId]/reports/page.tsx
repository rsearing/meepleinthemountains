import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateRange, fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EventAdminNav } from "@/components/event-admin-nav";

type PlanningAttendee = {
  id: string;
  profile_id: string;
  shirt_opted_out: boolean | null;
  shirt_choice_updated_at: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    owner_profile_id: string | null;
    allergies: string[];
    snack_preferences: string[];
    food_preferences: string[];
  } | null;
};

type GroupedPreference = {
  label: string;
  names: string[];
};

type OwnerProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

type MissingItem = {
  id: string;
  name: string;
  email: string | null;
  emailName: string | null;
  dependentOf: string | null;
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

function hasSelections(values: string[] | null | undefined) {
  return Boolean(values?.some((value) => value.trim()));
}

function buildMissingItem(attendee: PlanningAttendee, ownersById: Map<string, OwnerProfile>): MissingItem | null {
  if (!attendee.profiles) {
    return null;
  }

  const owner = attendee.profiles.owner_profile_id
    ? ownersById.get(attendee.profiles.owner_profile_id)
    : null;
  const emailProfile = owner ?? attendee.profiles;

  return {
    id: attendee.id,
    name: fullName(attendee.profiles),
    email: emailProfile.email,
    emailName: fullName(emailProfile),
    dependentOf: owner ? fullName(owner) : null
  };
}

function buildMailtoHref({
  eventName,
  eventDates,
  itemLabel,
  items
}: {
  eventName: string;
  eventDates: string;
  itemLabel: string;
  items: MissingItem[];
}) {
  const byEmail = new Map<string, { emailName: string; names: string[] }>();

  for (const item of items) {
    if (!item.email) {
      continue;
    }

    const entry = byEmail.get(item.email) ?? { emailName: item.emailName ?? "there", names: [] };
    if (!entry.names.includes(item.name)) {
      entry.names.push(item.name);
    }
    byEmail.set(item.email, entry);
  }

  const recipients = [...byEmail.keys()].sort((a, b) => a.localeCompare(b));
  const householdLines = [...byEmail.entries()]
    .sort((a, b) => a[1].emailName.localeCompare(b[1].emailName))
    .map(([, entry]) => `- ${entry.emailName}: ${entry.names.join(", ")}`)
    .join("\n");

  const body = [
    `Hi,`,
    "",
    `I'm getting ready for ${eventName} (${eventDates}) and noticed I still need ${itemLabel} from you.`,
    "",
    "Could you please log in to the Board Games with Rob Events site and update this when you have a chance?",
    "",
    householdLines ? `This reminder applies to:\n${householdLines}` : "",
    "",
    "Thank you!",
    "Rob"
  ]
    .filter((line) => line !== "")
    .join("\n");

  return `mailto:?bcc=${encodeURIComponent(recipients.join(","))}&subject=${encodeURIComponent(
    `${eventName}: ${itemLabel} reminder`
  )}&body=${encodeURIComponent(body)}`;
}

export default async function EventPlanningReportPage({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdmin();
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: attendees }, { data: shirtOrders }] = await Promise.all([
    supabase.from("events").select("id,name,start_date,end_date").eq("id", eventId).maybeSingle(),
    supabase
      .from("event_attendees")
      .select(
        "id,profile_id,shirt_opted_out,shirt_choice_updated_at,profiles(id,first_name,last_name,email,owner_profile_id,allergies,snack_preferences,food_preferences)"
      )
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("shirt_orders").select("profile_id,quantity").eq("event_id", eventId)
  ]);

  if (!event) {
    notFound();
  }

  const attendeeRows = (attendees ?? []) as unknown as PlanningAttendee[];
  const ownerIds = [
    ...new Set(
      attendeeRows
        .map((attendee) => attendee.profiles?.owner_profile_id)
        .filter((ownerId): ownerId is string => Boolean(ownerId))
    )
  ];
  const { data: ownerRows } = ownerIds.length
    ? await supabase.from("profiles").select("id,first_name,last_name,email").in("id", ownerIds)
    : { data: [] };
  const ownersById = new Map((ownerRows ?? []).map((owner) => [owner.id, owner as OwnerProfile]));
  const attendeesByName = [...attendeeRows].sort((a, b) =>
    fullName(a.profiles ?? { first_name: "", last_name: "" }).localeCompare(
      fullName(b.profiles ?? { first_name: "", last_name: "" })
    )
  );
  const orderedShirtProfileIds = new Set(
    (shirtOrders ?? [])
      .filter((order) => (order.quantity ?? 0) > 0)
      .map((order) => order.profile_id)
  );
  const allergies = groupPreferences(attendeeRows, "allergies");
  const snacks = groupPreferences(attendeeRows, "snack_preferences");
  const foods = groupPreferences(attendeeRows, "food_preferences");
  const missingShirts = attendeesByName
    .filter((attendee) => !orderedShirtProfileIds.has(attendee.profile_id) && !attendee.shirt_opted_out)
    .map((attendee) => buildMissingItem(attendee, ownersById))
    .filter((item): item is MissingItem => Boolean(item));
  const missingAllergies = attendeesByName
    .filter((attendee) => !hasSelections(attendee.profiles?.allergies))
    .map((attendee) => buildMissingItem(attendee, ownersById))
    .filter((item): item is MissingItem => Boolean(item));
  const missingSnacks = attendeesByName
    .filter((attendee) => !hasSelections(attendee.profiles?.snack_preferences))
    .map((attendee) => buildMissingItem(attendee, ownersById))
    .filter((item): item is MissingItem => Boolean(item));
  const missingFoods = attendeesByName
    .filter((attendee) => !hasSelections(attendee.profiles?.food_preferences))
    .map((attendee) => buildMissingItem(attendee, ownersById))
    .filter((item): item is MissingItem => Boolean(item));
  const eventDates = formatDateRange(event.start_date, event.end_date);

  return (
    <section className="grid">
      <div className="page-title">
        <h1>{event.name} Planning Report</h1>
        <p>Follow up on missing choices, then copy the shopping and allergy lists for planning.</p>
      </div>
      <EventAdminNav eventId={eventId} current="reports" />

      <div className="grid two planning-reports">
        <MissingChoicesReport
          title="No T-shirt Response"
          itemLabel="your T-shirt choice"
          eventName={event.name}
          eventDates={eventDates}
          rows={missingShirts}
        />
        <MissingChoicesReport
          title="No Allergies Listed"
          itemLabel="allergy information"
          eventName={event.name}
          eventDates={eventDates}
          rows={missingAllergies}
        />
        <MissingChoicesReport
          title="No Snack Preferences"
          itemLabel="snack preferences"
          eventName={event.name}
          eventDates={eventDates}
          rows={missingSnacks}
        />
        <MissingChoicesReport
          title="No Food Preferences"
          itemLabel="food preferences"
          eventName={event.name}
          eventDates={eventDates}
          rows={missingFoods}
        />
      </div>

      <div className="grid three planning-reports">
        <PreferenceReport title="Food Shopping List" itemLabel="Food" rows={foods} />
        <PreferenceReport title="Snack Shopping List" itemLabel="Snack" rows={snacks} />
        <AllergyReport attendees={attendeesByName} />
      </div>
    </section>
  );
}

function MissingChoicesReport({
  title,
  itemLabel,
  eventName,
  eventDates,
  rows
}: {
  title: string;
  itemLabel: string;
  eventName: string;
  eventDates: string;
  rows: MissingItem[];
}) {
  const emailableCount = rows.filter((row) => row.email).length;
  return (
    <div className="panel">
      <div className="report-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{rows.length} people need follow-up.</p>
        </div>
        {rows.length > 0 ? (
          <a className="button secondary" href={buildMailtoHref({ eventName, eventDates, itemLabel, items: rows })}>
            Email reminders
          </a>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="muted">Everyone is set.</p>
      ) : (
        <>
          {emailableCount < rows.length ? (
            <p className="notice">{rows.length - emailableCount} people do not have an email address on file.</p>
          ) : null}
          <ul className="plain-list">
            {rows.map((row) => (
              <li key={row.id}>
                {row.name}
                {row.dependentOf ? ` (dependent of ${row.dependentOf})` : ""}
                {row.email ? <span className="muted"> - sends to {row.emailName}</span> : <span className="muted"> - no email</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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

function AllergyReport({ attendees }: { attendees: PlanningAttendee[] }) {
  const rows = attendees.filter((attendee) => hasSelections(attendee.profiles?.allergies));

  return (
    <div className="panel table-wrap">
      <h2>Allergy List by Person</h2>
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Allergies</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2}>None listed.</td>
            </tr>
          ) : (
            rows.map((attendee) => (
              <tr key={attendee.id}>
                <td>
                  {attendee.profiles ? fullName(attendee.profiles) : "Unknown"}
                  {attendee.profiles?.owner_profile_id ? " (Dependent)" : ""}
                </td>
                <td>{attendee.profiles?.allergies.filter((value) => value.trim()).join(", ")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

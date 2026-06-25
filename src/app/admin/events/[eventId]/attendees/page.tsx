import {
  assignAttendee,
  createAndAssignAttendee,
  removeAttendee,
  updateAllAttendeeBeds
} from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/format";
import { EventAdminNav } from "@/components/event-admin-nav";

type AttendeeRow = {
  id: string;
  bed_id: string | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    owner_profile_id: string | null;
  } | null;
};

type BedRow = {
  id: string;
  name: string;
  capacity: number;
};

export default async function AdminAttendeesPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { eventId } = await params;
  const paramsValue = (await searchParams) ?? {};
  const error = typeof paramsValue.error === "string" ? paramsValue.error : null;
  const saved = typeof paramsValue.saved === "string" ? paramsValue.saved : null;
  const supabase = await createClient();
  const [{ data: attendees }, { data: profiles }, { data: shirtSizes }, { data: beds }] = await Promise.all([
    supabase
      .from("event_attendees")
      .select("id,bed_id,profiles(id,first_name,last_name,email,phone,owner_profile_id)")
      .eq("event_id", eventId)
      .order("created_at"),
    supabase.from("profiles").select("id,first_name,last_name,email,role,owner_profile_id").order("last_name"),
    supabase.from("shirt_sizes").select("id,label").eq("active", true).order("sort_order"),
    supabase.from("event_beds").select("id,name,capacity").eq("event_id", eventId).order("sort_order")
  ]);
  const assigned = (attendees ?? []) as unknown as AttendeeRow[];
  const bedRows = (beds ?? []) as BedRow[];
  const bedOccupancy = new Map(
    bedRows.map((bed) => [bed.id, assigned.filter((attendee) => attendee.bed_id === bed.id).length])
  );
  const assignedIds = new Set(assigned.map((row) => row.profiles?.id));
  const availableProfiles = (profiles ?? []).filter(
    (profile) => !profile.owner_profile_id && !assignedIds.has(profile.id)
  );
  const dependentsByOwner = new Map<string, typeof profiles>();
  for (const profile of profiles ?? []) {
    if (!profile.owner_profile_id) {
      continue;
    }
    const dependents = dependentsByOwner.get(profile.owner_profile_id) ?? [];
    dependents.push(profile);
    dependentsByOwner.set(profile.owner_profile_id, dependents);
  }

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Event Attendees</h1>
        <p>Assign existing profiles to this event.</p>
      </div>
      <EventAdminNav eventId={eventId} current="attendees" />
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <div className="grid two">
        <form className="panel form" action={createAndAssignAttendee}>
          <h2>Create and Assign Attendee</h2>
          <input type="hidden" name="event_id" value={eventId} />
          <div className="grid two">
            <div className="field">
              <label htmlFor="first_name">First name</label>
              <input id="first_name" name="first_name" required />
            </div>
            <div className="field">
              <label htmlFor="last_name">Last name</label>
              <input id="last_name" name="last_name" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="shirt_size_id">T-shirt size</label>
            <select id="shirt_size_id" name="shirt_size_id" defaultValue="">
              <option value="">Choose a size</option>
              {(shirtSizes ?? []).map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="grid two">
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" />
            </div>
            <div className="field">
              <label htmlFor="password">Initial password</label>
              <input id="password" name="password" type="password" minLength={6} required />
            </div>
          </div>
          <p className="muted">Enter preferences one per line. Commas also work.</p>
          <div className="grid two">
            <div className="field">
              <label htmlFor="allergies">Allergies</label>
              <textarea id="allergies" name="allergies" />
            </div>
            <div className="field">
              <label htmlFor="drink_preferences">Drink preferences</label>
              <textarea id="drink_preferences" name="drink_preferences" />
            </div>
            <div className="field">
              <label htmlFor="snack_preferences">Snack preferences</label>
              <textarea id="snack_preferences" name="snack_preferences" />
            </div>
            <div className="field">
              <label htmlFor="food_preferences">Food preferences</label>
              <textarea id="food_preferences" name="food_preferences" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="comments">User comments</label>
            <textarea id="comments" name="comments" />
          </div>
          <button className="button" type="submit">
            Create and assign
          </button>
        </form>

        <form className="panel form assign-existing-form" action={assignAttendee}>
          <h2>Assign Existing User</h2>
          <p className="muted">Assigning a primary attendee also assigns all of their dependents.</p>
          <input type="hidden" name="event_id" value={eventId} />
          <div className="field">
            <label htmlFor="profile_ids">Users</label>
            <select id="profile_ids" name="profile_ids" multiple size={Math.min(Math.max(availableProfiles.length, 4), 10)} required>
              {availableProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.first_name} {profile.last_name} - {profile.email}
                  {(dependentsByOwner.get(profile.id) ?? []).map(
                    (dependent) => ` + ${dependent.first_name} ${dependent.last_name} (dependent)`
                  )}
                </option>
              ))}
            </select>
            <span className="muted">Hold Ctrl while clicking to choose multiple people.</span>
          </div>
          <button className="button secondary" type="submit">
            Assign selected users
          </button>
        </form>
      </div>
      <form id="all-bed-assignments" action={updateAllAttendeeBeds}>
        <input type="hidden" name="event_id" value={eventId} />
      </form>
      <div className="panel table-wrap">
        <div className="table-heading-actions">
          <div>
            <h2>Assigned Attendees</h2>
            <p className="muted">Adjust any number of bed selections, then save them together.</p>
          </div>
          <button className="button" type="submit" form="all-bed-assignments">
            Save All Bed Assignments
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Bed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {assigned.length === 0 ? (
              <tr>
                <td colSpan={5}>No attendees assigned.</td>
              </tr>
            ) : (
              assigned.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.profiles ? fullName(row.profiles) : "Unknown"}
                    {row.profiles?.owner_profile_id ? " (Dependent)" : ""}
                  </td>
                  <td>{row.profiles?.email ?? "-"}</td>
                  <td>{row.profiles?.phone ?? "-"}</td>
                  <td>
                    <div className="attendee-bed-form">
                      <select
                        name="bed_assignment"
                        form="all-bed-assignments"
                        defaultValue={`${row.id}|${row.bed_id ?? ""}`}
                        aria-label={`Bed for ${row.profiles ? fullName(row.profiles) : "attendee"}`}
                      >
                        <option value={`${row.id}|`}>Not assigned</option>
                        {bedRows.map((bed) => {
                          const occupancy = bedOccupancy.get(bed.id) ?? 0;
                          return (
                            <option key={bed.id} value={`${row.id}|${bed.id}`}>
                              {bed.name} ({occupancy}/{bed.capacity})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </td>
                  <td>
                    {row.profiles?.owner_profile_id ? (
                      <span className="muted">Inherited from primary attendee</span>
                    ) : (
                      <form action={removeAttendee}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="event_id" value={eventId} />
                        <button className="button danger" type="submit">
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="table-footer-actions">
          <button className="button" type="submit" form="all-bed-assignments">
            Save All Bed Assignments
          </button>
        </div>
      </div>
    </section>
  );
}

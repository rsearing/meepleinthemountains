import { createBed, updateBed, updateBedSlot } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/format";
import { EventAdminNav } from "@/components/event-admin-nav";

type Bed = { id: string; name: string; bed_type: string | null; capacity: number; sort_order: number };
type Attendee = {
  id: string;
  bed_id: string | null;
  profiles: { first_name: string; last_name: string; email: string | null; owner_profile_id: string | null } | null;
};

export default async function AdminBedsPage({
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
  const [{ data: beds }, { data: attendees }] = await Promise.all([
    supabase.from("event_beds").select("id,name,bed_type,capacity,sort_order").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("event_attendees")
      .select("id,bed_id,profiles(first_name,last_name,email,owner_profile_id)")
      .eq("event_id", eventId)
      .order("created_at")
  ]);
  const bedRows = (beds ?? []) as Bed[];
  const attendeeRows = (attendees ?? []) as unknown as Attendee[];
  const assignedCountByBed = new Map(
    bedRows.map((bed) => [bed.id, attendeeRows.filter((row) => row.bed_id === bed.id).length])
  );

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Beds</h1>
        <p>Create named beds with capacity and assign attendees.</p>
      </div>
      <EventAdminNav eventId={eventId} current="beds" />
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <form className="panel form" action={createBed}>
        <h2>Add Bed</h2>
        <input type="hidden" name="event_id" value={eventId} />
        <div className="grid three">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" placeholder="Queen 1" required />
          </div>
          <div className="field">
            <label htmlFor="bed_type">Type</label>
            <input id="bed_type" name="bed_type" placeholder="Queen" />
          </div>
          <div className="field">
            <label htmlFor="capacity">Capacity</label>
            <input id="capacity" name="capacity" type="number" min={1} defaultValue={1} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="sort_order">Sort order</label>
          <input id="sort_order" name="sort_order" type="number" defaultValue={0} />
        </div>
        <button className="button" type="submit">
          Add bed
        </button>
      </form>

      <div className="panel">
        <h2>Edit Beds</h2>
        <div className="grid">
          {bedRows.length === 0 ? <p className="muted">No beds have been added yet.</p> : null}
          {bedRows.map((bed) => (
            <form className="bed-edit-form" action={updateBed} key={bed.id}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="bed_id" value={bed.id} />
              <div className="field">
                <label htmlFor={`bed-name-${bed.id}`}>Name</label>
                <input id={`bed-name-${bed.id}`} name="name" defaultValue={bed.name} required />
              </div>
              <div className="field">
                <label htmlFor={`bed-type-${bed.id}`}>Type</label>
                <input id={`bed-type-${bed.id}`} name="bed_type" defaultValue={bed.bed_type ?? ""} />
              </div>
              <div className="field">
                <label htmlFor={`bed-capacity-${bed.id}`}>Capacity</label>
                <input
                  id={`bed-capacity-${bed.id}`}
                  name="capacity"
                  type="number"
                  min={assignedCountByBed.get(bed.id) || 1}
                  defaultValue={bed.capacity}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`bed-sort-${bed.id}`}>Sort</label>
                <input
                  id={`bed-sort-${bed.id}`}
                  name="sort_order"
                  type="number"
                  defaultValue={bed.sort_order}
                  required
                />
              </div>
              <div className="bed-edit-status">
                <span>
                  {assignedCountByBed.get(bed.id) ?? 0} / {bed.capacity} assigned
                </span>
                <button className="button secondary" type="submit">
                  Save bed
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="page-title compact">
        <h2>Bed Assignments</h2>
        <p>Each row represents one available place in a bed.</p>
      </div>
      <div className="grid two">
        {bedRows.map((bed) => {
          const occupants = attendeeRows.filter((attendee) => attendee.bed_id === bed.id);
          const slots = Array.from({ length: bed.capacity }, (_, index) => occupants[index] ?? null);

          return (
            <div className="panel bed-slots" key={bed.id}>
              <div className="bed-slots-heading">
                <div>
                  <h2>{bed.name}</h2>
                  <p className="muted">{bed.bed_type || "Bed"} - {bed.capacity} slot{bed.capacity === 1 ? "" : "s"}</p>
                </div>
                <span className="status active">{occupants.length}/{bed.capacity}</span>
              </div>
              <div className="grid">
                {slots.map((occupant, index) => (
                  <form className="bed-slot" action={updateBedSlot} key={`${bed.id}-${index}`}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="bed_id" value={bed.id} />
                    <input type="hidden" name="current_attendee_id" value={occupant?.id ?? ""} />
                    <label htmlFor={`slot-${bed.id}-${index}`}>Slot {index + 1}</label>
                    <select
                      id={`slot-${bed.id}-${index}`}
                      name="selected_attendee_id"
                      defaultValue={occupant?.id ?? ""}
                    >
                      <option value="">Not assigned</option>
                      {attendeeRows.map((attendee) => {
                        const currentBed = bedRows.find((row) => row.id === attendee.bed_id);
                        return (
                          <option key={attendee.id} value={attendee.id}>
                            {attendee.profiles ? fullName(attendee.profiles) : "Unknown"}
                            {attendee.profiles?.owner_profile_id ? " (Dependent)" : ""}
                            {currentBed && currentBed.id !== bed.id ? ` (currently ${currentBed.name})` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button className="button secondary" type="submit">
                      Save
                    </button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h2>Unassigned Attendees</h2>
        {attendeeRows.filter((attendee) => !attendee.bed_id).length === 0 ? (
          <p className="muted">Everyone has a bed assignment.</p>
        ) : (
          <ul className="plain-list">
            {attendeeRows
              .filter((attendee) => !attendee.bed_id)
              .map((attendee) => (
                <li key={attendee.id}>
                  {attendee.profiles ? fullName(attendee.profiles) : "Unknown"}
                  {attendee.profiles?.owner_profile_id ? " (Dependent)" : ""}
                  {attendee.profiles?.email ? ` - ${attendee.profiles.email}` : ""}
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}

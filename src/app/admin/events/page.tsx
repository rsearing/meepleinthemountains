import Link from "next/link";
import { ClearEventDraft } from "@/components/clear-event-draft";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/format";
import type { EventRecord } from "@/lib/types";

export default async function AdminEventsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("start_date", { ascending: false });
  const events = (data ?? []) as EventRecord[];

  return (
    <section className="grid">
      <ClearEventDraft draftKey="event-form-draft:new" />
      <div className="actions">
        <div className="page-title">
          <h1>Events</h1>
          <p>Create and manage retreats.</p>
        </div>
        <Link className="button" href="/admin/events/new">
          New event
        </Link>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Dates</th>
              <th>Location</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5}>No events yet.</td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{formatDateRange(event.start_date, event.end_date)}</td>
                  <td>{event.location}</td>
                  <td>
                    <span className={`status ${event.status}`}>{event.status}</span>
                  </td>
                  <td>
                    <Link className="button secondary" href={`/admin/events/${event.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

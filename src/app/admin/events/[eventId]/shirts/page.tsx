import Link from "next/link";
import { EventAdminNav } from "@/components/event-admin-nav";
import { assignShirtDesign, removeShirtDesignFromEvent } from "@/lib/actions/shirts";
import { requireAdmin } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";

type AttendeeProfile = {
  id: string;
  first_name: string;
  last_name: string;
  owner_profile_id: string | null;
};

type OrderSize = {
  size_label: string;
  price_cents: number;
  shirt_designs: { name: string };
};

export default async function EventShirtsPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { eventId } = await params;
  const query = (await searchParams) ?? {};
  const admin = createAdminClient();
  const [{ data: designs }, { data: assigned }, { data: attendees }, { data: orders }] = await Promise.all([
    admin.from("shirt_designs").select("id,name").eq("active", true).order("name"),
    admin
      .from("event_shirt_designs")
      .select(
        "design_id,shirt_designs(id,name,description,image_path,shirt_design_sizes(id,size_label,price_cents,sort_order))"
      )
      .eq("event_id", eventId),
    admin
      .from("event_attendees")
      .select("profile_id,shirt_opted_out,shirt_choice_updated_at,profiles(id,first_name,last_name,owner_profile_id)")
      .eq("event_id", eventId),
    admin
      .from("shirt_orders")
      .select("id,profile_id,quantity,shirt_design_sizes(size_label,price_cents,shirt_designs(name))")
      .eq("event_id", eventId)
  ]);
  const assignedIds = new Set((assigned ?? []).map((row) => row.design_id));
  const total = (orders ?? []).reduce(
    (sum, row) =>
      sum + row.quantity * ((row.shirt_design_sizes as unknown as { price_cents: number })?.price_cents ?? 0),
    0
  );

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Event Shirts</h1>
        <p>Choose available designs and review the complete order.</p>
      </div>
      <EventAdminNav eventId={eventId} current="shirts" />
      {typeof query.error === "string" ? <div className="error">{query.error}</div> : null}
      {typeof query.saved === "string" ? <div className="notice">Saved successfully.</div> : null}

      <form className="panel form" action={assignShirtDesign}>
        <input type="hidden" name="event_id" value={eventId} />
        <div className="field">
          <label htmlFor="design_id">Add design</label>
          <select id="design_id" name="design_id" required>
            <option value="">Choose design</option>
            {(designs ?? [])
              .filter((design) => !assignedIds.has(design.id))
              .map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name}
                </option>
              ))}
          </select>
        </div>
        <button className="button" type="submit">
          Make available
        </button>
      </form>

      <div className="grid two">
        {(assigned ?? []).map((row) => {
          const design = row.shirt_designs as unknown as { id: string; name: string; description: string };
          return (
            <article className="panel" key={row.design_id}>
              <h2>{design.name}</h2>
              <p>{design.description}</p>
              <form action={removeShirtDesignFromEvent}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="design_id" value={row.design_id} />
                <button className="button danger">Remove from event</button>
              </form>
            </article>
          );
        })}
      </div>

      <div className="panel table-wrap">
        <h2>Attendee Shirt Choices</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(attendees ?? []).map((row) => {
              const person = row.profiles as unknown as AttendeeProfile;
              const itemCount = (orders ?? [])
                .filter((order) => order.profile_id === row.profile_id)
                .reduce((sum, order) => sum + order.quantity, 0);
              const status = row.shirt_opted_out
                ? "Declined"
                : itemCount > 0
                  ? `Ordered (${itemCount})`
                  : row.shirt_choice_updated_at
                    ? "No shirt selected"
                    : "No response";

              return (
                <tr key={row.profile_id}>
                  <td>{person ? fullName(person) : "Unknown"}</td>
                  <td>
                    <strong>{status}</strong>
                  </td>
                  <td>
                    <Link className="button secondary" href={`/events/${eventId}/shirts?profile=${row.profile_id}`}>
                      Edit choices
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel table-wrap">
        <h2>Order Report</h2>
        <p>
          <strong>Total order cost: ${(total / 100).toFixed(2)}</strong>
        </p>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Design</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Cost</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((order) => {
              const person = (attendees ?? []).find((attendee) => attendee.profile_id === order.profile_id)
                ?.profiles as unknown as AttendeeProfile | null;
              const size = order.shirt_design_sizes as unknown as OrderSize;
              return (
                <tr key={order.id}>
                  <td>{person ? fullName(person) : "Unknown"}</td>
                  <td>{size?.shirt_designs?.name}</td>
                  <td>{size?.size_label}</td>
                  <td>{order.quantity}</td>
                  <td>${(((size?.price_cents ?? 0) * order.quantity) / 100).toFixed(2)}</td>
                  <td>
                    <Link className="button secondary" href={`/events/${eventId}/shirts?profile=${order.profile_id}`}>
                      Edit choices
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

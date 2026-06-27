import Link from "next/link";
import { notFound } from "next/navigation";
import { saveShirtOrders } from "@/lib/actions/shirts";
import { requireProfile } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";

type ShirtPerson = {
  id: string;
  first_name: string;
  last_name: string;
  owner_profile_id: string | null;
};

type ShirtDesign = {
  id: string;
  name: string;
  description: string;
  shirt_design_images: { id: string; storage_path: string; sort_order: number }[];
  shirt_design_sizes: {
    id: string;
    size_label: string;
    price_cents: number;
    sort_order: number;
    active: boolean;
  }[];
};

export default async function EventShirtOrderPage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const { eventId } = await params;
  const query = (await searchParams) ?? {};
  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("event_attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!assignment && profile.role !== "admin") notFound();

  const requestedProfileId = profile.role === "admin" && typeof query.profile === "string" ? query.profile : null;
  const [{ data: deps }, { data: designRows }, { data: orders }, { data: shirtChoices }, { data: requestedProfile }] =
    await Promise.all([
      admin.from("profiles").select("id,first_name,last_name,owner_profile_id").eq("owner_profile_id", profile.id),
      admin
        .from("event_shirt_designs")
        .select(
          "shirt_designs(id,name,description,shirt_design_images(id,storage_path,sort_order),shirt_design_sizes(id,size_label,price_cents,sort_order,active))"
        )
        .eq("event_id", eventId)
        .eq("active", true),
      admin.from("shirt_orders").select("profile_id,design_size_id,quantity").eq("event_id", eventId),
      admin
        .from("event_attendees")
        .select("profile_id,shirt_opted_out,shirt_choice_updated_at")
        .eq("event_id", eventId),
      requestedProfileId
        ? admin
            .from("profiles")
            .select("id,first_name,last_name,owner_profile_id")
            .eq("id", requestedProfileId)
            .maybeSingle()
        : Promise.resolve({ data: null })
    ]);

  const people = (requestedProfile ? [requestedProfile] : [profile, ...(deps ?? [])]) as ShirtPerson[];
  const availableDesigns = designRows ?? [];

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Event Shirts</h1>
        <p>Choose shirt quantities or tell the organizer that you do not wish to purchase a T-shirt.</p>
      </div>
      {typeof query.saved === "string" ? <div className="notice">Shirt choices saved.</div> : null}
      {typeof query.error === "string" ? <div className="error">{query.error}</div> : null}
      {availableDesigns.length === 0 ? (
        <div className="panel">
          <h2>No shirts available</h2>
          <p className="muted">The organizer has not assigned a shirt design to this event yet.</p>
          {profile.role === "admin" ? (
            <Link className="button" href={`/admin/events/${eventId}/shirts`}>
              Assign shirt designs
            </Link>
          ) : null}
        </div>
      ) : (
        people.map((person) => {
          const shirtChoice = (shirtChoices ?? []).find((choice) => choice.profile_id === person.id);

          return (
            <form className="panel form" action={saveShirtOrders} key={person.id}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="profile_id" value={person.id} />
              <h2>{fullName(person)}</h2>
              {availableDesigns.map((row) => {
                const design = row.shirt_designs as unknown as ShirtDesign;
                const images = [...(design.shirt_design_images ?? [])].sort(
                  (first, second) => first.sort_order - second.sort_order
                );

                return (
                  <div className="shirt-order-design" key={design.id}>
                    {images.length ? (
                      <div className="shirt-image-gallery">
                        {images.map((image, index) => (
                          <img
                            className="shirt-image"
                            src={admin.storage.from("shirt-images").getPublicUrl(image.storage_path).data.publicUrl}
                            alt={`${design.name} sample ${index + 1}`}
                            key={image.id}
                          />
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <h3>{design.name}</h3>
                      <p>{design.description}</p>
                      <div className="shirt-size-grid">
                        {design.shirt_design_sizes
                          .filter((size) => size.active)
                          .sort((first, second) => first.sort_order - second.sort_order)
                          .map((size) => {
                            const existing =
                              (orders ?? []).find(
                                (order) => order.profile_id === person.id && order.design_size_id === size.id
                              )?.quantity ?? 0;
                            return (
                              <label key={size.id}>
                                {size.size_label} (${(size.price_cents / 100).toFixed(2)})
                                <select name="quantity" defaultValue={`${size.id}|${existing}`}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((quantity) => (
                                    <option key={quantity} value={`${size.id}|${quantity}`}>
                                      {quantity}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="shirt-opt-out">
                <label className="checkbox-field" htmlFor={`shirt-opt-out-${person.id}`}>
                  <input
                    id={`shirt-opt-out-${person.id}`}
                    name="shirt_opted_out"
                    type="checkbox"
                    defaultChecked={shirtChoice?.shirt_opted_out ?? false}
                  />
                  I do not wish to purchase a T-shirt
                </label>
                <p className="muted">Selecting this option will clear any saved shirt quantities for this person.</p>
              </div>
              <button className="button" type="submit">
                Save shirt choices
              </button>
            </form>
          );
        })
      )}
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ShirtOrderForm, type ShirtOrderDesign } from "@/components/shirt-order-form";
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
  const shirtOrderDesigns: ShirtOrderDesign[] = availableDesigns.map((row) => {
    const design = row.shirt_designs as unknown as ShirtDesign;
    const images = [...(design.shirt_design_images ?? [])].sort(
      (first, second) => first.sort_order - second.sort_order
    );

    return {
      id: design.id,
      name: design.name,
      description: design.description,
      images: images.map((image, index) => ({
        id: image.id,
        url: admin.storage.from("shirt-images").getPublicUrl(image.storage_path).data.publicUrl,
        alt: `${design.name} sample ${index + 1}`
      })),
      sizes: design.shirt_design_sizes
        .filter((size) => size.active)
        .sort((first, second) => first.sort_order - second.sort_order)
        .map((size) => ({
          id: size.id,
          label: size.size_label,
          priceCents: size.price_cents
        }))
    };
  });

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
          const initialQuantities = Object.fromEntries(
            shirtOrderDesigns.flatMap((design) =>
              design.sizes.map((size) => [
                size.id,
                (orders ?? []).find(
                  (order) => order.profile_id === person.id && order.design_size_id === size.id
                )?.quantity ?? 0
              ])
            )
          );

          return (
            <ShirtOrderForm
              eventId={eventId}
              profileId={person.id}
              personName={fullName(person)}
              designs={shirtOrderDesigns}
              initialQuantities={initialQuantities}
              initiallyOptedOut={shirtChoice?.shirt_opted_out ?? false}
              key={person.id}
            />
          );
        })
      )}
    </section>
  );
}

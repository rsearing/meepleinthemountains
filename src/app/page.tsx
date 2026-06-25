import Image from "next/image";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { availableBedSlots, formatDateRange } from "@/lib/format";
import type { EventRecord, EventImage } from "@/lib/types";

type PublicEvent = EventRecord & {
  event_images: EventImage[];
  event_beds: { id: string; capacity: number }[];
  event_attendees: { id: string; profile_id: string; bed_id: string | null }[];
  games_brought: { id: string; title: string; profile_id: string }[];
};

export default async function Home() {
  const profile = await getCurrentProfile();
  const supabase = createAdminClient();
  const visibleStatuses =
    profile?.role === "admin" ? ["draft", "upcoming", "active"] : ["upcoming", "active"];
  const { data: events } = await supabase
    .from("events")
    .select(
      "id, name, start_date, end_date, location, description, status, event_images(id,event_id,storage_path,alt_text,sort_order), event_beds(id,capacity), event_attendees(id,profile_id,bed_id), games_brought(id,title,profile_id)"
    )
    .in("status", visibleStatuses)
    .order("start_date", { ascending: true });

  const publicEvents = (events ?? []) as PublicEvent[];

  return (
    <>
      <section className="hero">
        <Image
          className="hero-logo"
          src="/board-games-with-rob-logo.png"
          alt="Board Games with Rob logo"
          width={250}
          height={213}
          priority
        />
        <h1>Board Games with Rob</h1>
      </section>

      <section className="grid">
        {publicEvents.length === 0 ? (
          <div className="panel">
            <h2>No upcoming events yet</h2>
            <p className="muted">Check back soon for the next Board Games with Rob event.</p>
          </div>
        ) : (
          publicEvents.map((event) => {
            const image = [...event.event_images].sort((a, b) => a.sort_order - b.sort_order)[0];
            const totalBeds = event.event_beds.reduce((sum, bed) => sum + bed.capacity, 0);
            const assigned = event.event_attendees.length;
            const available = availableBedSlots(event.event_beds, event.event_attendees);
            const imageUrl = image
              ? supabase.storage.from("event-images").getPublicUrl(image.storage_path).data.publicUrl
              : null;
            const assignedProfileIds = new Set(event.event_attendees.map((attendee) => attendee.profile_id));
            const broughtGames = event.games_brought
              .filter((game) => assignedProfileIds.has(game.profile_id))
              .sort((a, b) => a.title.localeCompare(b.title));

            return (
              <article className="card" key={event.id}>
                <div className="public-event-main">
                  <div className="public-event-summary">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="event-image" src={imageUrl} alt={image.alt_text ?? event.name} />
                  ) : (
                    <div className="event-image event-image-placeholder">No event image</div>
                  )}
                    <div className="event-card-heading">
                      <h2>{event.name}</h2>
                      {event.status === "draft" ? <span className="status draft">Draft</span> : null}
                    </div>
                    <p className="muted">
                      {formatDateRange(event.start_date, event.end_date)} at {event.location}
                    </p>
                    <p>{event.description}</p>
                  </div>
                  <div className="public-games-list">
                    <h3>Games Being Brought</h3>
                    {broughtGames.length ? (
                      <ul>
                        {broughtGames.map((game) => <li key={game.id}>{game.title}</li>)}
                      </ul>
                    ) : (
                      <p className="muted">No games listed yet.</p>
                    )}
                  </div>
                </div>
                <div className="grid three">
                  <div className="metric">
                    <strong>{available}</strong>
                    Beds available
                  </div>
                  <div className="metric">
                    <strong>{assigned}</strong>
                    Attendees assigned
                  </div>
                  <div className="metric">
                    <strong>{totalBeds}</strong>
                    Total bed slots
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}

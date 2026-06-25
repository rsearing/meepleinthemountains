import { createEvent } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { EventForm } from "@/components/event-form";

export default async function NewEventPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="grid two">
      <div className="page-title">
        <h1>New Event</h1>
        <p>Add the next Board Games with Rob event.</p>
      </div>
      <EventForm action={createEvent} error={error} />
    </section>
  );
}

import { notFound } from "next/navigation";
import { updateEvent } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/event-form";
import { EventAdminNav } from "@/components/event-admin-nav";
import type { EventRecord } from "@/lib/types";

export default async function AdminEventDetailPage({
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
  const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();

  if (!data) {
    notFound();
  }

  const event = data as EventRecord;

  return (
    <section className="grid">
      <div className="page-title">
        <h1>{event.name}</h1>
        <p>Manage this event and its attendee setup.</p>
      </div>
      {saved ? <div className="notice">Saved successfully.</div> : null}
      <EventAdminNav eventId={event.id} current="details" />
      <EventForm action={updateEvent} event={event} error={error} />
    </section>
  );
}

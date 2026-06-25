"use client";

import { useEffect, useState } from "react";
import type { EventRecord } from "@/lib/types";

type EventFormValues = Pick<
  EventRecord,
  "name" | "start_date" | "end_date" | "location" | "status" | "description"
>;

export function EventForm({
  action,
  event,
  error
}: {
  action: (formData: FormData) => Promise<void>;
  event?: EventRecord;
  error?: string | null;
}) {
  const initialValues: EventFormValues = {
    name: event?.name ?? "",
    start_date: event?.start_date ?? "",
    end_date: event?.end_date ?? "",
    location: event?.location ?? "",
    status: event?.status ?? "upcoming",
    description: event?.description ?? ""
  };
  const draftKey = `event-form-draft:${event?.id ?? "new"}`;
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const savedDraft = window.sessionStorage.getItem(draftKey);

    if (!savedDraft) {
      return;
    }

    try {
      setValues(JSON.parse(savedDraft) as EventFormValues);
    } catch {
      window.sessionStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  function updateValue<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    setValidationError(null);
    window.sessionStorage.setItem(draftKey, JSON.stringify(nextValues));
  }

  function validateDates(eventValue: React.FormEvent<HTMLFormElement>) {
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      eventValue.preventDefault();
      setValidationError("End date must be the same as or later than the start date.");
    }
  }

  return (
    <form className="panel form" action={action} onSubmit={validateDates} encType="multipart/form-data">
      {validationError || error ? <div className="error">{validationError ?? error}</div> : null}
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <div className="field">
        <label htmlFor="name">Event name</label>
        <input
          id="name"
          name="name"
          value={values.name}
          onChange={(changeEvent) => updateValue("name", changeEvent.target.value)}
          required
        />
      </div>
      <div className="grid two">
        <div className="field">
          <label htmlFor="start_date">Start date</label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            value={values.start_date}
            max={values.end_date || undefined}
            onChange={(changeEvent) => updateValue("start_date", changeEvent.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="end_date">End date</label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            value={values.end_date}
            min={values.start_date || undefined}
            onChange={(changeEvent) => updateValue("end_date", changeEvent.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="location">Location</label>
        <input
          id="location"
          name="location"
          value={values.location}
          onChange={(changeEvent) => updateValue("location", changeEvent.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          name="status"
          value={values.status}
          onChange={(changeEvent) => updateValue("status", changeEvent.target.value as EventRecord["status"])}
        >
          <option value="draft">Draft</option>
          <option value="upcoming">Upcoming</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={values.description}
          onChange={(changeEvent) => updateValue("description", changeEvent.target.value)}
        />
      </div>
      {!event ? (
        <>
          <div className="field">
            <label htmlFor="image">Event image</label>
            <input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            <small className="muted">Optional. Upload a JPG, PNG, or WebP image up to 10 MB.</small>
          </div>
          <div className="field">
            <label htmlFor="image_alt_text">Image description</label>
            <input
              id="image_alt_text"
              name="image_alt_text"
              placeholder="Cabin and mountains at the retreat"
            />
          </div>
        </>
      ) : null}
      <button className="button" type="submit">
        Save event
      </button>
    </form>
  );
}

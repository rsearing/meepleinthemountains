export function formatDateRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  if (start === end) {
    return formatter.format(startDate);
  }

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

export function fullName(profile: { first_name: string; last_name: string }) {
  return `${profile.first_name} ${profile.last_name}`.trim();
}

export function privateDisplayName(profile: { first_name: string; last_name: string }) {
  const initial = profile.last_name.trim().charAt(0);
  return `${profile.first_name}${initial ? ` ${initial}.` : ""}`;
}

export function availableBedSlots(
  beds: { id: string; capacity: number }[],
  attendees: { bed_id: string | null }[]
) {
  const occupiedBedIds = new Set(
    attendees
      .map((attendee) => attendee.bed_id)
      .filter((bedId): bedId is string => Boolean(bedId))
  );

  return beds.reduce(
    (total, bed) => total + (occupiedBedIds.has(bed.id) ? 0 : bed.capacity),
    0
  );
}

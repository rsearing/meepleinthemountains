import Link from "next/link";

type EventAdminSection = "details" | "attendees" | "beds" | "images" | "games" | "shirts" | "reports";

const links: { section: EventAdminSection; label: string; path: string }[] = [
  { section: "details", label: "Event Details", path: "" },
  { section: "attendees", label: "Attendees", path: "/attendees" },
  { section: "beds", label: "Beds", path: "/beds" },
  { section: "images", label: "Images", path: "/images" },
  { section: "games", label: "Inventory and Wishlist", path: "/games" },
  { section: "shirts", label: "Shirts", path: "/shirts" },
  { section: "reports", label: "Planning Report", path: "/reports" }
];

export function EventAdminNav({
  eventId,
  current
}: {
  eventId: string;
  current: EventAdminSection;
}) {
  return (
    <nav className="event-admin-nav" aria-label="Event management">
      {links.map((link) => {
        const href =
          link.section === "games"
            ? `/events/${eventId}/games`
            : `/admin/events/${eventId}${link.path}`;
        const active = link.section === current;

        return (
          <Link
            className={`button ${active ? "" : "secondary"}`}
            href={href}
            aria-current={active ? "page" : undefined}
            key={link.section}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

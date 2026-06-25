import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const adminLinks = [
  { href: "/admin/events", title: "Events", text: "Create and manage yearly retreats." },
  { href: "/admin/users", title: "Users", text: "Create attendee accounts and update profiles." },
  { href: "/admin/shirts", title: "Shirt Designs", text: "Create shirt designs with images, sizes, and prices." },
  { href: "/admin/reports", title: "Reports", text: "Review attendees, food notes, beds, and games." }
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Admin</h1>
        <p>Manage events, attendees, beds, images, games, and retreat reports.</p>
      </div>
      <div className="grid two">
        {adminLinks.map((item) => (
          <Link className="card" href={item.href} key={item.href}>
            <h2>{item.title}</h2>
            <p className="muted">{item.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

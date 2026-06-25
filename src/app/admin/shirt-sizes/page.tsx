import { upsertShirtSize } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ShirtSize } from "@/lib/types";

export default async function ShirtSizesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const supabase = await createClient();
  const { data } = await supabase.from("shirt_sizes").select("*").order("sort_order");
  const sizes = (data ?? []) as ShirtSize[];

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Shirt Sizes</h1>
        <p>Manage the list attendees can choose from.</p>
      </div>
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <form className="panel form" action={upsertShirtSize}>
        <h2>Add Size</h2>
        <div className="grid three">
          <div className="field">
            <label htmlFor="label">Label</label>
            <input id="label" name="label" required />
          </div>
          <div className="field">
            <label htmlFor="sort_order">Sort order</label>
            <input id="sort_order" name="sort_order" type="number" defaultValue={0} />
          </div>
          <div className="field">
            <label htmlFor="active">Active</label>
            <input id="active" name="active" type="checkbox" defaultChecked />
          </div>
        </div>
        <button className="button" type="submit">
          Add size
        </button>
      </form>
      <div className="grid two">
        {sizes.map((size) => (
          <form className="panel form" action={upsertShirtSize} key={size.id}>
            <input type="hidden" name="id" value={size.id} />
            <div className="field">
              <label htmlFor={`label-${size.id}`}>Label</label>
              <input id={`label-${size.id}`} name="label" defaultValue={size.label} required />
            </div>
            <div className="field">
              <label htmlFor={`sort-${size.id}`}>Sort order</label>
              <input id={`sort-${size.id}`} name="sort_order" type="number" defaultValue={size.sort_order} />
            </div>
            <div className="field">
              <label htmlFor={`active-${size.id}`}>Active</label>
              <input id={`active-${size.id}`} name="active" type="checkbox" defaultChecked={size.active} />
            </div>
            <button className="button secondary" type="submit">
              Save size
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

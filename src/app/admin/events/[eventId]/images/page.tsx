import { addEventImage, deleteEventImage, updateEventImage } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventAdminNav } from "@/components/event-admin-nav";

export default async function AdminImagesPage({
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
  const { data: images } = await supabase
    .from("event_images")
    .select("id,storage_path,alt_text,sort_order")
    .eq("event_id", eventId)
    .order("sort_order");

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Images</h1>
        <p>Add, replace, reorder, or remove public event images.</p>
      </div>
      <EventAdminNav eventId={eventId} current="images" />
      {saved ? <div className="notice">Saved successfully.</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <form className="panel form" action={addEventImage} encType="multipart/form-data">
        <input type="hidden" name="event_id" value={eventId} />
        <div className="field">
          <label htmlFor="image">Image upload</label>
          <input id="image" name="image" type="file" accept="image/*" />
        </div>
        <div className="field">
          <label htmlFor="storage_path">Existing storage path</label>
          <input id="storage_path" name="storage_path" placeholder="events/2026/cabin.jpg" />
        </div>
        <div className="field">
          <label htmlFor="alt_text">Alt text</label>
          <input id="alt_text" name="alt_text" />
        </div>
        <div className="field">
          <label htmlFor="sort_order">Sort order</label>
          <input id="sort_order" name="sort_order" type="number" defaultValue={0} />
        </div>
        <button className="button" type="submit">
          Add image
        </button>
      </form>
      <div className="grid two image-management-grid">
        {(images ?? []).length === 0 ? <div className="panel muted">No images have been added.</div> : null}
        {(images ?? []).map((image) => {
          const imageUrl = supabase.storage.from("event-images").getPublicUrl(image.storage_path).data.publicUrl;
          return (
            <article className="panel image-management-item" key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="event-image" src={imageUrl} alt={image.alt_text ?? "Event image"} />
              <form className="form" action={updateEventImage} encType="multipart/form-data">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="image_id" value={image.id} />
                <div className="field">
                  <label htmlFor={`replacement-${image.id}`}>Replace image</label>
                  <input id={`replacement-${image.id}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" />
                </div>
                <div className="field">
                  <label htmlFor={`alt-${image.id}`}>Alt text</label>
                  <input id={`alt-${image.id}`} name="alt_text" defaultValue={image.alt_text ?? ""} />
                </div>
                <div className="field">
                  <label htmlFor={`sort-${image.id}`}>Sort order</label>
                  <input id={`sort-${image.id}`} name="sort_order" type="number" defaultValue={image.sort_order} />
                </div>
                <p className="image-storage-path muted">{image.storage_path}</p>
                <button className="button" type="submit">Save image</button>
              </form>
              <form className="form image-delete-form" action={deleteEventImage}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="image_id" value={image.id} />
                <label className="checkbox-field">
                  <input name="confirm_delete" type="checkbox" required />
                  Confirm deletion
                </label>
                <button className="button danger" type="submit">Delete image</button>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}

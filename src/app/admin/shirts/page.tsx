import {
  addShirtDesignImages,
  createShirtDesign,
  deleteShirtDesign,
  deleteShirtDesignImage,
  updateShirtDesign
} from "@/lib/actions/shirts";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

type ShirtDesign = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  shirt_design_images: { id: string; storage_path: string; sort_order: number }[];
  shirt_design_sizes: {
    id: string;
    size_label: string;
    price_cents: number;
    sort_order: number;
    active: boolean;
  }[];
};

function sizesToText(sizes: ShirtDesign["shirt_design_sizes"]) {
  return [...sizes]
    .filter((size) => size.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((size) => `${size.size_label}, ${(size.price_cents / 100).toFixed(2)}`)
    .join("\n");
}

export default async function ShirtsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const admin = createAdminClient();
  const { data } = await admin
    .from("shirt_designs")
    .select(
      "id,name,description,active,shirt_design_images(id,storage_path,sort_order),shirt_design_sizes(id,size_label,price_cents,sort_order,active)"
    )
    .order("created_at");
  const designs = (data ?? []) as ShirtDesign[];

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Shirt Designs</h1>
        <p>Create reusable designs with size-specific prices.</p>
      </div>

      {typeof params.error === "string" ? <div className="error">{params.error}</div> : null}
      {typeof params.saved === "string" ? <div className="notice">Saved successfully.</div> : null}

      <form className="panel form" action={createShirtDesign} encType="multipart/form-data">
        <h2>Add Design</h2>
        <div className="field">
          <label htmlFor="shirt-name">Name</label>
          <input id="shirt-name" name="name" required />
        </div>
        <div className="field">
          <label htmlFor="shirt-description">Description</label>
          <textarea id="shirt-description" name="description" />
        </div>
        <div className="field">
          <label htmlFor="shirt-images">Sample images</label>
          <input id="shirt-images" name="images" type="file" accept="image/*" multiple />
        </div>
        <div className="field">
          <label htmlFor="shirt-sizes">Sizes and prices</label>
          <textarea id="shirt-sizes" name="sizes" placeholder={"S, 20.00\nM, 20.00\n2XL, 23.00"} required />
          <span className="muted">One size per line: size, price</span>
        </div>
        <button className="button" type="submit">
          Create shirt design
        </button>
      </form>

      <div className="grid two">
        {designs.map((design) => {
          const images = [...(design.shirt_design_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);

          return (
            <article className="panel shirt-design-card" key={design.id}>
              {images.length ? (
                <div className="shirt-image-gallery">
                  {images.map((image, index) => {
                    const imageUrl = admin.storage.from("shirt-images").getPublicUrl(image.storage_path).data.publicUrl;

                    return (
                      <div className="shirt-image-edit" key={image.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="shirt-image" src={imageUrl} alt={`${design.name} sample ${index + 1}`} />
                        <form action={deleteShirtDesignImage}>
                          <input type="hidden" name="image_id" value={image.id} />
                          <button className="button danger" type="submit">
                            Delete image
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="shirt-image-placeholder">No image</div>
              )}

              <form className="form" action={updateShirtDesign}>
                <input type="hidden" name="design_id" value={design.id} />
                <div className="field">
                  <label htmlFor={`design-name-${design.id}`}>Name</label>
                  <input id={`design-name-${design.id}`} name="name" defaultValue={design.name} required />
                </div>
                <div className="field">
                  <label htmlFor={`design-description-${design.id}`}>Description</label>
                  <textarea
                    id={`design-description-${design.id}`}
                    name="description"
                    defaultValue={design.description}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`design-sizes-${design.id}`}>Sizes and prices</label>
                  <textarea id={`design-sizes-${design.id}`} name="sizes" defaultValue={sizesToText(design.shirt_design_sizes)} required />
                  <span className="muted">Omitted sizes become inactive instead of being deleted.</span>
                </div>
                <button className="button secondary" type="submit">
                  Save design
                </button>
              </form>

              <form className="form" action={addShirtDesignImages} encType="multipart/form-data">
                <input type="hidden" name="design_id" value={design.id} />
                <div className="field">
                  <label htmlFor={`more-images-${design.id}`}>Add more images</label>
                  <input id={`more-images-${design.id}`} name="images" type="file" accept="image/*" multiple required />
                </div>
                <button className="button secondary" type="submit">
                  Upload images
                </button>
              </form>

              <form className="form image-delete-form" action={deleteShirtDesign}>
                <input type="hidden" name="design_id" value={design.id} />
                <label className="checkbox-row">
                  <input name="confirm_delete" type="checkbox" required />
                  Confirm deleting this shirt design, its images, event assignments, and shirt orders.
                </label>
                <button className="button danger" type="submit">
                  Delete design
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}

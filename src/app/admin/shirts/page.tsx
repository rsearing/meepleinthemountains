import { addShirtDesignImages, createShirtDesign } from "@/lib/actions/shirts";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function ShirtsPage({ searchParams }: { searchParams?: Promise<Record<string,string|string[]|undefined>> }) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const admin = createAdminClient();
  const { data } = await admin.from("shirt_designs")
    .select("id,name,description,active,shirt_design_images(id,storage_path,sort_order),shirt_design_sizes(id,size_label,price_cents,sort_order)")
    .order("created_at");
  return <section className="grid">
    <div className="page-title"><h1>Shirt Designs</h1><p>Create reusable designs with size-specific prices.</p></div>
    {typeof params.error === "string" ? <div className="error">{params.error}</div> : null}
    {typeof params.saved === "string" ? <div className="notice">Saved successfully.</div> : null}
    <form className="panel form" action={createShirtDesign} encType="multipart/form-data">
      <h2>Add Design</h2>
      <div className="field"><label htmlFor="shirt-name">Name</label><input id="shirt-name" name="name" required /></div>
      <div className="field"><label htmlFor="shirt-description">Description</label><textarea id="shirt-description" name="description" /></div>
      <div className="field"><label htmlFor="shirt-images">Sample images</label><input id="shirt-images" name="images" type="file" accept="image/*" multiple /></div>
      <div className="field"><label htmlFor="shirt-sizes">Sizes and prices</label><textarea id="shirt-sizes" name="sizes" placeholder={"S, 20.00\nM, 20.00\n2XL, 23.00"} required /><span className="muted">One size per line: size, price</span></div>
      <button className="button" type="submit">Create shirt design</button>
    </form>
    <div className="grid two">
      {(data ?? []).map((design) => {
        const images = [...(design.shirt_design_images ?? [])].sort((a,b)=>a.sort_order-b.sort_order);
        return <article className="panel shirt-design-card" key={design.id}>
          {images.length ? <div className="shirt-image-gallery">{images.map((image,index)=><img className="shirt-image" src={admin.storage.from("shirt-images").getPublicUrl(image.storage_path).data.publicUrl} alt={`${design.name} sample ${index+1}`} key={image.id}/>)}</div> : <div className="shirt-image-placeholder">No image</div>}
          <h2>{design.name}</h2><p>{design.description}</p>
          <ul>{[...(design.shirt_design_sizes ?? [])].sort((a,b)=>a.sort_order-b.sort_order).map(size => <li key={size.id}>{size.size_label}: ${(size.price_cents/100).toFixed(2)}</li>)}</ul>
          <form className="form" action={addShirtDesignImages} encType="multipart/form-data"><input type="hidden" name="design_id" value={design.id}/><div className="field"><label htmlFor={`more-images-${design.id}`}>Add more images</label><input id={`more-images-${design.id}`} name="images" type="file" accept="image/*" multiple required/></div><button className="button secondary" type="submit">Upload images</button></form>
        </article>;
      })}
    </div>
  </section>;
}

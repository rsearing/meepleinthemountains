"use client";

import { useState } from "react";
import { saveShirtOrders } from "@/lib/actions/shirts";

export type ShirtOrderDesign = {
  id: string;
  name: string;
  description: string;
  images: { id: string; url: string; alt: string }[];
  sizes: { id: string; label: string; priceCents: number }[];
};

export function ShirtOrderForm({
  eventId,
  profileId,
  personName,
  designs,
  initialQuantities,
  initiallyOptedOut
}: {
  eventId: string;
  profileId: string;
  personName: string;
  designs: ShirtOrderDesign[];
  initialQuantities: Record<string, number>;
  initiallyOptedOut: boolean;
}) {
  const [optedOut, setOptedOut] = useState(initiallyOptedOut);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    initiallyOptedOut
      ? Object.fromEntries(Object.keys(initialQuantities).map((sizeId) => [sizeId, 0]))
      : initialQuantities
  );
  const [warning, setWarning] = useState<string | null>(null);

  function handleOptOutChange(checked: boolean) {
    setOptedOut(checked);
    setWarning(null);
    if (checked) {
      setQuantities((current) =>
        Object.fromEntries(Object.keys(current).map((sizeId) => [sizeId, 0]))
      );
    }
  }

  function handleQuantityChange(sizeId: string, quantity: number) {
    if (optedOut && quantity > 0) {
      const message = "Remove the no T-shirt checkmark before selecting a shirt quantity.";
      setWarning(message);
      window.alert(message);
      return;
    }

    setWarning(null);
    setQuantities((current) => ({ ...current, [sizeId]: quantity }));
  }

  return (
    <form className="panel form" action={saveShirtOrders}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="profile_id" value={profileId} />
      <h2>{personName}</h2>
      {warning ? (
        <div className="error" role="alert">
          {warning}
        </div>
      ) : null}
      {designs.map((design) => (
        <div className="shirt-order-design" key={design.id}>
          {design.images.length ? (
            <div className="shirt-image-gallery">
              {design.images.map((image) => (
                <img className="shirt-image" src={image.url} alt={image.alt} key={image.id} />
              ))}
            </div>
          ) : null}
          <div>
            <h3>{design.name}</h3>
            <p>{design.description}</p>
            <div className="shirt-size-grid">
              {design.sizes.map((size) => {
                const quantity = quantities[size.id] ?? 0;
                return (
                  <label key={size.id}>
                    {size.label} (${(size.priceCents / 100).toFixed(2)})
                    <select
                      name="quantity"
                      value={`${size.id}|${quantity}`}
                      onChange={(event) => {
                        const [, nextQuantity] = event.target.value.split("|");
                        handleQuantityChange(size.id, Number(nextQuantity));
                      }}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((optionQuantity) => (
                        <option key={optionQuantity} value={`${size.id}|${optionQuantity}`}>
                          {optionQuantity}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      <div className="shirt-opt-out">
        <label className="checkbox-field" htmlFor={`shirt-opt-out-${profileId}`}>
          <input
            id={`shirt-opt-out-${profileId}`}
            name="shirt_opted_out"
            type="checkbox"
            checked={optedOut}
            onChange={(event) => handleOptOutChange(event.target.checked)}
          />
          I do not wish to purchase a T-shirt
        </label>
        <p className="muted">Selecting this option clears every shirt quantity for this person.</p>
      </div>
      <button className="button" type="submit">
        Save shirt choices
      </button>
    </form>
  );
}

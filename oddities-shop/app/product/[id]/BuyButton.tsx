"use client";

import { useState } from "react";

export default function BuyButton({ productId }: { productId: string }) {
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    const existing = JSON.parse(
      localStorage.getItem("cart") || "[]"
    ) as { productId: string; quantity: number }[];

    const found = existing.find((item) => item.productId === productId);

    if (found) {
      found.quantity += 1;
    } else {
      existing.push({ productId, quantity: 1 });
    }

    localStorage.setItem("cart", JSON.stringify(existing));
    window.dispatchEvent(new Event("storage"));
    setAdded(true);

    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button onClick={handleAddToCart} className="buyBtn">
      {added ? "Added ✓" : "Add to Cart"}
    </button>
  );
}

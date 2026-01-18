"use client";

import { useState } from "react";

export default function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId, // 🔥 THIS IS THE KEY FIX
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error ?? "Checkout failed");
        setLoading(false);
        return;
      }

      // Redirect to Square checkout
      window.location.href = json.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong starting checkout.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="buyBtn"
      style={{ opacity: loading ? 0.6 : 1 }}
    >
      {loading ? "Redirecting…" : "Buy"}
    </button>
  );
}

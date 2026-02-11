"use client";

import { useState } from "react";

export default function BuyButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [fulfillment, setFulfillment] = useState<"shipping" | "pickup">(
    "shipping"
  );

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
          productId,
          fulfillment,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error ?? "Checkout failed");
        setLoading(false);
        return;
      }

      // ✅ Real redirect (no debug)
      window.location.href = json.url;

    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong starting checkout.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 8, cursor: "pointer" }}>
          <input
            type="radio"
            checked={fulfillment === "shipping"}
            onChange={() => setFulfillment("shipping")}
          />
          Ship to me
        </label>

        <label style={{ display: "flex", gap: 8, cursor: "pointer" }}>
          <input
            type="radio"
            checked={fulfillment === "pickup"}
            onChange={() => setFulfillment("pickup")}
          />
          In-person pickup
        </label>
      </div>

      <button
        onClick={handleBuy}
        disabled={loading}
        className="buyBtn"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Redirecting…" : "Buy"}
      </button>
    </div>
  );
}

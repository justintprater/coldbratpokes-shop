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

      // Redirect to Square checkout
      window.location.href = json.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong starting checkout.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {/* Shipping option */}
        <label style={{ display: "flex", gap: 8, cursor: "pointer" }}>
          <input
            type="radio"
            checked={fulfillment === "shipping"}
            onChange={() => setFulfillment("shipping")}
          />
          Ship to me
        </label>

        {fulfillment === "shipping" && (
          <div
            style={{
              fontSize: 14,
              color: "#666",
              marginTop: 6,
              marginLeft: 24,
            }}
          >
            $10 flat domestic shipping (U.S. only)
          </div>
        )}

        {/* Pickup option */}
        <label
          style={{
            display: "flex",
            gap: 8,
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          <input
            type="radio"
            checked={fulfillment === "pickup"}
            onChange={() => setFulfillment("pickup")}
          />
          In-person pickup (free)
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

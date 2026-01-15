"use client";

import { useState } from "react";

export default function BuyButton({
  productId,
  title,
  price_cents,
  disabled,
}: {
  productId: string;
  title: string;
  price_cents: number;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);

    try {
      setLoading(true);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, title, price_cents }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErr(data?.error ?? "Checkout failed");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setErr("Square did not return a checkout URL.");
    } catch (e: any) {
      setErr(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="buyBtn" disabled={disabled || loading} onClick={go}>
        {disabled ? "Sold out" : loading ? "Loading…" : "Buy now"}
      </button>

      {err ? (
        <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
          {err}
        </p>
      ) : null}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ProductImage = { url: string | null };

export type ProductRow = {
  id: string;
  title: string;
  price_cents: number;
  status: "available" | "reserved" | "sold" | "hidden";
  quantity_available: number;
  product_images?: ProductImage[] | null;
};

export default function ShopTabs({ products }: { products: ProductRow[] }) {
  const [tab, setTab] = useState<"available" | "sold">("available");

  const filtered = useMemo(() => {
    if (tab === "available") {
      return products.filter(
        (p) =>
          p.status !== "hidden" &&
          p.quantity_available > 0
      );
    }

    return products.filter((p) => p.quantity_available <= 0);
  }, [products, tab]);

  return (
    <div className="shopLayout">
      <aside className="sideMenu">
        <button
          type="button"
          className={`sideItem ${tab === "available" ? "sideItemActive" : ""}`}
          onClick={() => setTab("available")}
        >
          Available
        </button>

        <button
          type="button"
          className={`sideItem ${tab === "sold" ? "sideItemActive" : ""}`}
          onClick={() => setTab("sold")}
        >
          Sold Archive
        </button>
      </aside>

      <section className="shopContent">
        {filtered.length === 0 ? (
          <div className="emptyState">
            {tab === "available"
              ? "No available items right now."
              : "No sold items yet."}
          </div>
        ) : (
          <div className="grid">
            {filtered.map((p) => {
              const imgUrl = p.product_images?.[0]?.url ?? null;
              const price = (p.price_cents / 100).toFixed(2);

              const isSold = p.quantity_available <= 0;
              const isReserved = p.status === "reserved";

              return (
                <Link key={p.id} href={`/product/${p.id}`} className="card">
                  <div className="media">
                    {imgUrl ? (
                      <img src={imgUrl} alt={p.title} />
                    ) : (
                      <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                        No image
                      </div>
                    )}

                    {isSold && <div className="soldOverlay">SOLD</div>}
                    {isReserved && !isSold && (
                      <div className="soldOverlay">RESERVED</div>
                    )}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 750, fontSize: 16 }}>
                      {p.title}
                    </div>

                    <div className="badge">
                      {isSold
                        ? "sold"
                        : isReserved
                        ? "reserved"
                        : p.quantity_available === 1
                        ? "1 left"
                        : `${p.quantity_available} in stock`}
                    </div>

                    <div style={{ marginTop: 8, fontFamily: "monospace" }}>
                      ${price}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

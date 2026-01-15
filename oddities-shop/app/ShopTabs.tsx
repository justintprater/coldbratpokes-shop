"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ProductImage = { url: string | null };
export type ProductRow = {
  id: string;
  title: string;
  price_cents: number;
  status: "available" | "sold" | "hidden";
  product_images?: ProductImage[] | null;
};

export default function ShopTabs({ products }: { products: ProductRow[] }) {
  const [tab, setTab] = useState<"available" | "sold">("available");

  const filtered = useMemo(() => {
    return products.filter((p) => p.status === tab);
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
              const isSold = p.status === "sold";

              return (
                <Link key={p.id} href={`/product/${p.id}`} className="card">
                  <div className="media">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt={p.title} />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--muted)",
                          fontSize: 12,
                        }}
                      >
                        No image yet
                      </div>
                    )}

                    {isSold ? <div className="soldOverlay">SOLD</div> : null}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 750, fontSize: 16 }}>
                      {p.title}
                    </div>

                    <div className="badge">
                      <span className="pinkDot" />
                      {isSold ? "sold" : "available"} • one-of-one
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

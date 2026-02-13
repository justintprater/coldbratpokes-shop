export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import BuyButton from "./BuyButton";

type ProductImage = { url: string | null };

type ProductRow = {
  id: string;
  title: string;
  price_cents: number;
  status: "available" | "reserved" | "sold" | "hidden";
  description: string | null;
  quantity_available: number;
  product_images?: ProductImage[] | null;
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id?: string }> | { id?: string };
}) {
  const p = await Promise.resolve(params);
  const id = p.id;

  if (!id) {
    return <main className="container">Missing product id.</main>;
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      title,
      price_cents,
      status,
      description,
      quantity_available,
      product_images ( url )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return <main className="container">Product not found.</main>;
  }

  const product = data as ProductRow;
  const price = (product.price_cents / 100).toFixed(2);
  const images = (product.product_images ?? [])
    .map((x) => x.url)
    .filter((u): u is string => Boolean(u));
  const mainImg = images[0];

  const isSold = product.quantity_available <= 0;
  const isReserved = product.status === "reserved";

  return (
    <main className="container">
      <Link href="/">← Back to shop</Link>

      <div className="productLayout" style={{ marginTop: 18 }}>
        <div className="productMedia">
          {mainImg ? (
            <img src={mainImg} alt={product.title} />
          ) : (
            <div>No image yet</div>
          )}

          {isSold && <div className="soldOverlay">SOLD</div>}
          {isReserved && !isSold && (
            <div className="soldOverlay">RESERVED</div>
          )}
        </div>

        <div>
          <h1 className="productTitle">{product.title}</h1>

          <div className="productMeta">
            <span className="pinkDot" />
            <span>
              {isSold
                ? "sold"
                : isReserved
                ? "reserved"
                : product.quantity_available === 1
                ? "1 left"
                : `${product.quantity_available} in stock`}
            </span>
          </div>

          <div className="productPrice">${price}</div>

          {!isSold && !isReserved ? (
            <BuyButton productId={product.id} />
          ) : (
            <button className="buyBtn" disabled>
              {isSold ? "Sold" : "Reserved"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

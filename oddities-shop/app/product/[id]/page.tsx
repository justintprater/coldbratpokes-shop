import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import BuyButton from "./BuyButton";


type ProductImage = { url: string | null };

type ProductRow = {
  id: string;
  title: string;
  price_cents: number;
  status: "available" | "sold" | "hidden";
  description: string | null;
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
    return (
      <main className="container">
        <Link href="/" style={{ color: "var(--muted)" }}>
          ← Back
        </Link>
        <p style={{ marginTop: 16, color: "var(--muted)" }}>
          Missing product id in the URL.
        </p>
      </main>
    );
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
      product_images ( url )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <main className="container">
        <Link href="/" style={{ color: "var(--muted)" }}>
          ← Back
        </Link>
        <p style={{ marginTop: 16, color: "var(--muted)" }}>Product not found.</p>
        {error ? (
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify({ id, error }, null, 2)}
          </pre>
        ) : null}
      </main>
    );
  }

  const product = data as ProductRow;
  const price = (product.price_cents / 100).toFixed(2);
  const images = (product.product_images ?? [])
    .map((x) => x.url)
    .filter((u): u is string => Boolean(u));
  const mainImg = images[0];

  return (
    <main className="container">
      <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>
        ← Back to shop
      </Link>

      <div className="productLayout" style={{ marginTop: 18 }}>
        <div className="productMedia">
          {mainImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mainImg} alt={product.title} />
          ) : (
            <div
              style={{
                height: "100%",
                display: "grid",
                placeItems: "center",
                color: "var(--muted)",
              }}
            >
              No image yet
            </div>
          )}

          {product.status === "sold" ? <div className="soldOverlay">SOLD</div> : null}
        </div>

        <div>
          <h1 className="productTitle">{product.title}</h1>

          <div className="productMeta">
            <span className="pinkDot" />
            <span style={{ color: "var(--muted)" }}>
              {product.status === "sold" ? "sold" : "available"} • one-of-one
            </span>
          </div>

          <div className="productPrice">${price}</div>

          {product.description ? (
            <p className="productDesc">{product.description}</p>
          ) : (
            <p className="productDesc" style={{ color: "var(--muted)" }}>
              (No description yet)
            </p>
          )}

          <BuyButton
            productId={product.id}
            title={product.title}
            price_cents={product.price_cents}
            disabled={product.status === "sold"}
/>

        </div>
      </div>
    </main>
  );
}

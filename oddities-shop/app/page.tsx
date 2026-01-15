import { supabase } from "../lib/supabaseClient";
import ShopTabs, { type ProductRow } from "./ShopTabs";

type ProductImage = { url: string | null };

export default async function Home() {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      title,
      price_cents,
      status,
      product_images ( url )
    `
    )
    .neq("status", "hidden")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <>
        <header className="hero">
          <h1 className="brandTitle">ColdBratPokes x Lalam0e</h1>
          <p className="brandSub">Oddities • Engravings • Apparel • Print</p>
        </header>
        <main className="shopShell">
          <div className="container">
            <p style={{ color: "var(--muted)" }}>Failed to load products.</p>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        </main>
      </>
    );
  }

  const products = (data ?? []) as ProductRow[];

  return (
    <>
      <header className="hero">
        <h1 className="brandTitle">ColdBratPokes x Lalam0e</h1>
        <p className="brandSub">Oddities • Engravings • Apparel • Print</p>
      </header>

      <main className="shopShell">
        <ShopTabs products={products} />
      </main>
    </>
  );
}

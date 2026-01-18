import { supabaseServer } from "../lib/supabaseServer";
import ShopTabs, { type ProductRow } from "./ShopTabs";

export default async function Home() {
  /**
   * 🔁 AUTO-RELEASE EXPIRED RESERVATIONS
   * If reserved_until is in the past, make it available again.
   * This runs safely on every page load.
   */
  await supabaseServer
    .from("products")
    .update({
      status: "available",
      reserved_until: null,
    })
    .eq("status", "reserved")
    .lt("reserved_until", new Date().toISOString());

  /**
   * 🛒 FETCH PRODUCTS
   */
  const { data, error } = await supabaseServer
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
      <main style={{ padding: 40, color: "white" }}>
        <h1>Failed to load products</h1>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  const products = (data ?? []) as ProductRow[];

  return (
    <>
      <header className="hero">
        <h1 className="brandTitle">ColdBratPokes x Lalam0e</h1>
        <p className="brandSub">Oddities • Engravings • Apparel • Prints</p>
      </header>

      <main className="shopShell">
        <ShopTabs products={products} />
      </main>
    </>
  );
}

export const dynamic = "force-dynamic";

import { supabaseServer } from "../lib/supabaseServer";
import ShopTabs, { type ProductRow } from "./ShopTabs";

export default async function Home() {
  // Auto-release expired reservations
  await supabaseServer
    .from("products")
    .update({
      status: "available",
      reserved_until: null,
    })
    .eq("status", "reserved")
    .lt("reserved_until", new Date().toISOString());

  // Fetch products (now includes quantity)
  const { data, error } = await supabaseServer
    .from("products")
    .select(
      `
      id,
      title,
      price_cents,
      status,
      quantity_available,
      product_images ( url, sort_order )
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
        <h1 className="brandTitle">ColdBratPokes</h1>
        <p className="brandSub">Oddities • Engravings • Apparel • Prints</p>
      </header>

      <main className="shopShell">
        <ShopTabs products={products} />
      </main>
    </>
  );
}

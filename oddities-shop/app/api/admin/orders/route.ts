import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RawOrder = {
  id: string;
  created_at: string;
  status: string;
  fulfillment_method: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_instagram: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
};

type RawItem = {
  order_id: string;
  product_id: string;
  quantity: number;
  price_cents: number;
};

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));

  if (!password || password !== process.env.ADMIN_UPLOAD_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rawOrders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, created_at, status, fulfillment_method, customer_name, customer_email, customer_instagram, " +
      "shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_postal_code"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordersError) {
    console.error("[admin/orders] fetch error:", ordersError);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }

  const orders = (rawOrders ?? []) as unknown as RawOrder[];

  if (orders.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  const orderIds = orders.map((o) => o.id);

  const { data: rawItems, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("order_id, product_id, quantity, price_cents")
    .in("order_id", orderIds);

  if (itemsError) {
    console.error("[admin/orders] items fetch error:", itemsError);
  }

  const items = (rawItems ?? []) as unknown as RawItem[];
  const productIds = [...new Set(items.map((i) => i.product_id))];

  const productMap: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: rawProducts } = await supabaseAdmin
      .from("products")
      .select("id, title")
      .in("id", productIds);

    for (const p of (rawProducts ?? []) as { id: string; title: string }[]) {
      productMap[p.id] = p.title;
    }
  }

  const itemsByOrder: Record<string, { title: string; quantity: number; price_cents: number }[]> = {};
  for (const item of items) {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push({
      title: productMap[item.product_id] ?? "Unknown item",
      quantity: item.quantity,
      price_cents: item.price_cents,
    });
  }

  const result = orders.map((order) => ({
    ...order,
    items: itemsByOrder[order.id] ?? [],
  }));

  return NextResponse.json({ orders: result });
}

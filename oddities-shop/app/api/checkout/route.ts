import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), {
        status: 400,
      });
    }

    // 🛑 BACKEND STOCK VALIDATION
    for (const item of items) {
      const { data: product, error } = await supabase
        .from("products")
        .select("quantity_available")
        .eq("id", item.productId)
        .single();

      if (error || !product) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 400,
        });
      }

      if (product.quantity_available < item.quantity) {
        return new Response(
          JSON.stringify({ error: "Item out of stock" }),
          { status: 400 }
        );
      }
    }

    // 🧾 Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        status: "created",
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("❌ Order insert failed:", orderError);
      return new Response("Order failed", { status: 500 });
    }

    // 🧾 Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      price_cents: item.price_cents,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("❌ Order items insert failed:", itemsError);
      return new Response("Items failed", { status: 500 });
    }

    // 💳 Create Square payment link
    const response = await fetch(
      "https://connect.squareup.com/v2/online-checkout/payment-links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          order: {
            location_id: process.env.SQUARE_LOCATION_ID,
            line_items: items.map((item: any) => ({
              name: "Item",
              quantity: item.quantity.toString(),
              base_price_money: {
                amount: item.price_cents,
                currency: "USD",
              },
            })),
          },
        }),
      }
    );

    const data = await response.json();

    const paymentLink = data.payment_link;

    // 💾 Save Square IDs
    await supabase
      .from("orders")
      .update({
        square_payment_link_id: paymentLink.id,
        square_order_id: paymentLink.order_id,
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ url: paymentLink.url }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Checkout error:", err);
    return new Response("Server error", { status: 500 });
  }
}
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    console.log("🛒 ITEMS RECEIVED:", items);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), {
        status: 400,
      });
    }

    const normalizedItems = [];

    for (const item of items) {
      const quantity =
        item.quantity && item.quantity > 0 ? item.quantity : 1;

      // ✅ ALWAYS FETCH PRICE FROM DB (NOT FRONTEND)
      const { data: product, error } = await supabase
        .from("products")
        .select("id, quantity_available, price_cents")
        .eq("id", item.productId)
        .single();

      if (error || !product) {
        console.error("❌ Product not found:", item.productId);
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 400 }
        );
      }

      if (product.quantity_available < quantity) {
        console.error("❌ Not enough stock:", product.id);
        return new Response(
          JSON.stringify({ error: "Item out of stock" }),
          { status: 400 }
        );
      }

      normalizedItems.push({
        productId: product.id,
        quantity,
        price_cents: product.price_cents, // ✅ FIXED HERE
      });
    }

    const firstItem = normalizedItems[0];

    // ✅ CREATE ORDER (keep required fields)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        status: "created",
        product_id: firstItem.productId,
        quantity: firstItem.quantity,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("❌ Order insert failed:", orderError);
      return new Response("Order failed", { status: 500 });
    }

    // ✅ INSERT ORDER ITEMS (now guaranteed valid)
    const orderItems = normalizedItems.map((item) => ({
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

    // ✅ CREATE SQUARE LINK
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
            line_items: normalizedItems.map((item) => ({
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

    if (!data.payment_link) {
      console.error("❌ Square failed:", data);
      return new Response("Square error", { status: 500 });
    }

    const paymentLink = data.payment_link;

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
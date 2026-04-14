import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { items, customer } = await req.json();

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items" }), {
        status: 400,
      });
    }

    if (!customer?.email || !customer?.instagram) {
      return new Response(
        JSON.stringify({ error: "Email + Instagram required" }),
        { status: 400 }
      );
    }

    const normalizedItems = [];

    for (const item of items) {
      const quantity =
        item.quantity && item.quantity > 0 ? item.quantity : 1;

      const { data: product, error } = await supabase
        .from("products")
        .select("id, quantity_available, price_cents, title")
        .eq("id", item.productId)
        .single();

      if (error || !product) {
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 400 }
        );
      }

      if (product.quantity_available < quantity) {
        return new Response(
          JSON.stringify({ error: "Item out of stock" }),
          { status: 400 }
        );
      }

      normalizedItems.push({
        productId: product.id,
        quantity,
        price_cents: product.price_cents,
        title: product.title,
      });
    }

    const firstItem = normalizedItems[0];

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        status: "created",
        product_id: firstItem.productId,
        quantity: firstItem.quantity,
        metadata: customer, // ✅ NEW
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("❌ Order insert failed:", orderError);
      return new Response("Order failed", { status: 500 });
    }

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

    const isDelivery = customer.isDelivery;
    const deliveryFee = isDelivery ? 1000 : 0;

    const squareBaseUrl =
      process.env.SQUARE_ENV === "sandbox"
        ? "https://connect.squareupsandbox.com"
        : "https://connect.squareup.com";

    const response = await fetch(
      `${squareBaseUrl}/v2/online-checkout/payment-links`,
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
            line_items: [
              ...normalizedItems.map((item) => ({
                name: item.title,
                quantity: item.quantity.toString(),
                base_price_money: {
                  amount: item.price_cents,
                  currency: "USD",
                },
              })),
              ...(deliveryFee > 0
                ? [
                    {
                      name: "Delivery Fee",
                      quantity: "1",
                      base_price_money: {
                        amount: deliveryFee,
                        currency: "USD",
                      },
                    },
                  ]
                : []),
            ],
          },
          checkout_options: {
            redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/thank-you`,
          },
        }),
      }
    );

    const data = await response.json();

    if (!data.payment_link) {
      console.error("❌ Square failed:", data);
      return new Response("Square error", { status: 500 });
    }

    await supabase
      .from("orders")
      .update({
        square_payment_link_id: data.payment_link.id,
        square_order_id: data.payment_link.order_id,
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ url: data.payment_link.url }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Checkout error:", err);
    return new Response("Server error", { status: 500 });
  }
}
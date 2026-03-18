import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { items } = await req.json();

    if (!items || items.length === 0) {
      throw new Error("No items provided");
    }

    // 1. Build Square line items
    const lineItems = [];

    for (const item of items) {
      const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", item.productId)
        .single();

      if (error || !product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      lineItems.push({
        name: product.name,
        quantity: item.quantity.toString(),
        base_price_money: {
          amount: product.price,
          currency: "USD",
        },
      });
    }

    // 2. Create Square payment link
    const res = await fetch(
      "https://connect.squareup.com/v2/online-checkout/payment-links",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkout_options: {
            redirect_url: `${process.env.BASE_URL}/thank-you`,
          },
          order: {
            location_id: process.env.SQUARE_LOCATION_ID,
            line_items: lineItems,
          },
        }),
      }
    );

    const data = await res.json();

    if (!data.payment_link) {
      console.error(data);
      throw new Error("Square payment link failed");
    }

    // ✅ CRITICAL FIX — correct order ID
    const squareOrderId =
      data.related_resources?.orders?.[0]?.id;

    if (!squareOrderId) {
      throw new Error("Missing Square order ID");
    }

    // 3. Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        status: "created",
        square_order_id: squareOrderId,
      })
      .select()
      .single();

    if (orderError) {
      console.error(orderError);
      throw new Error("Order insert failed");
    }

    // 4. Insert order items
    for (const item of items) {
      const { error } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
      });

      if (error) {
        console.error(error);
        throw new Error("Order items insert failed");
      }
    }

    return NextResponse.json({ url: data.payment_link.url });
  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
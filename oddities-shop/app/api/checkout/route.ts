import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  console.log("CHECKOUT VERSION: FINAL FIX");

  try {
    const body = await req.json();
    console.log("REQUEST BODY:", body);

    const items = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No items provided");
    }

    // 🔹 Fetch all products
    const productIds = items.map((i: any) => i.productId);

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productError || !products) {
      console.error(productError);
      throw new Error("Failed to fetch products");
    }

    // 🔹 Build line items SAFELY
    const lineItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId);

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;

      return {
        name: product.name,
        quantity: String(quantity),
        base_price_money: {
          amount: Math.round(product.price * 100), // ✅ ensures cents
          currency: "USD",
        },
      };
    });

    if (!lineItems.length) {
      throw new Error("No valid line items");
    }

    console.log("LINE ITEMS:", lineItems);

    // 🔹 ENV CHECK (prevents silent Square failure)
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      throw new Error("Missing SQUARE_ACCESS_TOKEN");
    }

    if (!process.env.SQUARE_LOCATION_ID) {
      throw new Error("Missing SQUARE_LOCATION_ID");
    }

    // 🔹 Create Square payment link
    const res = await fetch(
      "https://connect.squareupsandbox.com/v2/online-checkout/payment-links",
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
            line_items: lineItems,
          },
        }),
      }
    );

    const rawText = await res.text();
    console.log("RAW SQUARE RESPONSE:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error("Invalid JSON from Square");
    }

    if (!res.ok) {
      throw new Error(`Square API error: ${rawText}`);
    }

    if (!data.payment_link) {
      throw new Error(`No payment_link in response: ${rawText}`);
    }

    const paymentLink = data.payment_link;

    console.log("PAYMENT LINK:", paymentLink);

    // 🔹 Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        square_order_id: paymentLink.order_id,
        status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error(orderError);
      throw new Error("Failed to create order");
    }

    // 🔹 Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity || 1,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error(itemsError);
      throw new Error("Failed to insert order items");
    }

    return NextResponse.json({ url: paymentLink.url });
  } catch (err: any) {
    console.error("CHECKOUT ERROR:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
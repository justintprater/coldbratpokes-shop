import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQUARE_BASE_URL = "https://connect.squareupsandbox.com";
// production later: https://connect.squareup.com

export async function POST(req: NextRequest) {
  try {
    const { productId, fulfillment } = await req.json();

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!product || product.status !== "available") {
      return NextResponse.json({ error: "Unavailable" }, { status: 400 });
    }

    // Reserve product
    await supabase
      .from("products")
      .update({
        status: "reserved",
        reserved_until: new Date(Date.now() + 15 * 60 * 1000),
      })
      .eq("id", product.id);

    // Create order
    const { data: order } = await supabase
      .from("orders")
      .insert({
        product_id: product.id,
        status: "created",
        fulfillment_method: fulfillment,
      })
      .select()
      .single();

    // Create Square payment link (NO SDK)
    const squareRes = await fetch(
      `${SQUARE_BASE_URL}/v2/online-checkout/payment-links`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          order: {
            location_id: process.env.SQUARE_LOCATION_ID,
            line_items: [
              {
                name: product.title,
                quantity: "1",
                base_price_money: {
                  amount: product.price_cents,
                  currency: "USD",
                },
              },
            ],
          },
          checkout_options: {
            ask_for_shipping_address: fulfillment === "shipping",
          },
        }),
      }
    );

    if (!squareRes.ok) {
      const err = await squareRes.text();
      throw new Error(err);
    }

    const squareData = await squareRes.json();

    const paymentLinkId = squareData.payment_link?.id;
    const paymentLinkUrl = squareData.payment_link?.url;

    if (!paymentLinkId || !paymentLinkUrl) {
      throw new Error("Invalid Square response");
    }

    await supabase
      .from("orders")
      .update({
        square_payment_link_id: paymentLinkId,
      })
      .eq("id", order.id);

    return NextResponse.json({ url: paymentLinkUrl });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

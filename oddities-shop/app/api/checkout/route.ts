export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sandbox now, switch later when you go live
const SQUARE_BASE_URL = "https://connect.squareupsandbox.com";
// production: https://connect.squareup.com

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productId = body?.productId;
    const fulfillment =
      body?.fulfillment === "pickup" ? "pickup" : "shipping";

    if (!productId) {
      return NextResponse.json(
        { error: "Missing productId" },
        { status: 400 }
      );
    }

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!product || product.status !== "available") {
      return NextResponse.json({ error: "Unavailable" }, { status: 400 });
    }

    // Reserve product for 15 minutes
    await supabase
      .from("products")
      .update({
        status: "reserved",
        reserved_until: new Date(Date.now() + 15 * 60 * 1000),
      })
      .eq("id", product.id);

    // Create internal order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        product_id: product.id,
        status: "created",
        fulfillment_method: fulfillment,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error("Failed to create order");
    }

    // Create Square payment link
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
            redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/thank-you`,
          },
        }),
      }
    );

    if (!squareRes.ok) {
      const err = await squareRes.text();
      throw new Error(`Square error: ${err}`);
    }

    const squareData = await squareRes.json();
    const paymentLink = squareData?.payment_link;

    if (!paymentLink?.id || !paymentLink?.url) {
      throw new Error("Invalid Square response");
    }

    // Store Square link ID for webhook lookup
    await supabase
      .from("orders")
      .update({
        square_payment_link_id: paymentLink.id,
      })
      .eq("id", order.id);

    return NextResponse.json({ url: paymentLink.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

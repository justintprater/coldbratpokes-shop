export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQUARE_BASE_URL = "https://connect.squareupsandbox.com";

export async function POST(req: NextRequest) {
  try {
    const { productId, fulfillment } = await req.json();

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

    if (!product) {
      return NextResponse.json({ error: "Unavailable" }, { status: 400 });
    }

    const now = new Date();

    const isReservedAndExpired =
      product.status === "reserved" &&
      product.reserved_until &&
      new Date(product.reserved_until) < now;

    if (product.status !== "available" && !isReservedAndExpired) {
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
      console.error("Square error:", err);
      throw new Error("Square checkout failed");
    }

    const squareData = await squareRes.json();

    const paymentLink = squareData?.payment_link;
    const squareOrderId = paymentLink?.order_id;

    if (!paymentLink?.id || !paymentLink?.url || !squareOrderId) {
      console.error("Bad Square response:", squareData);
      throw new Error("Invalid Square response");
    }

    // Create order WITH square_order_id
    await supabase.from("orders").insert({
      product_id: product.id,
      status: "created",
      fulfillment_method: fulfillment,
      square_order_id: squareOrderId,
      square_payment_link_id: paymentLink.id,
    });

    return NextResponse.json({ url: paymentLink.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SQUARE_BASE_URL =
  process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

export async function POST(req: NextRequest) {
  try {
    console.log("=== CHECKOUT START ===");

    const body = await req.json();
    console.log("Incoming body:", body);

    const { productId, fulfillment, quantity = 1 } = body;

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error || !product) {
      console.error("Product fetch error:", error);
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.status !== "available") {
      return NextResponse.json(
        { error: "Product unavailable" },
        { status: 400 }
      );
    }

    if (product.quantity_available < quantity) {
      return NextResponse.json(
        { error: "Not enough inventory" },
        { status: 400 }
      );
    }

    const lineItems = [
      {
        name: product.title,
        quantity: quantity.toString(),
        base_price_money: {
          amount: product.price_cents,
          currency: "USD",
        },
      },
    ];

    const squarePayload = {
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        line_items: lineItems,
        fulfillments:
          fulfillment === "shipping"
            ? [
                {
                  type: "SHIPMENT",
                  state: "PROPOSED",
                },
              ]
            : [],
      },
      checkout_options: {
        ask_for_shipping_address: fulfillment === "shipping",
        ask_for_email_address: true,
        ask_for_phone_number: true,
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/thank-you`,
      },
    };

    console.log("Sending to Square:", JSON.stringify(squarePayload, null, 2));

    const squareRes = await fetch(
      `${SQUARE_BASE_URL}/v2/online-checkout/payment-links`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(squarePayload),
      }
    );

    const squareText = await squareRes.text();
    console.log("Square raw response:", squareText);

    if (!squareRes.ok) {
      return NextResponse.json(
        { error: "Square failed", details: squareText },
        { status: 500 }
      );
    }

    const squareData = JSON.parse(squareText);

    if (!squareData.payment_link?.url) {
      return NextResponse.json(
        { error: "No payment link returned", squareData },
        { status: 500 }
      );
    }

    const paymentLink = squareData.payment_link;

    await supabase.from("orders").insert({
      product_id: product.id,
      quantity,
      fulfillment_method: fulfillment,
      status: "created",
      square_payment_link_id: paymentLink.id,
      square_order_id: paymentLink.order_id,
    });

    console.log("Returning URL:", paymentLink.url);

    return NextResponse.json({ url: paymentLink.url });
  } catch (err: any) {
    console.error("Checkout fatal error:", err);
    return NextResponse.json(
      { error: "Checkout crashed", details: err?.message },
      { status: 500 }
    );
  }
}

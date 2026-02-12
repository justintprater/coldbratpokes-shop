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

    console.log("LOCATION ID BEING USED:", process.env.SQUARE_LOCATION_ID);
    console.log("SQUARE ENV:", process.env.SQUARE_ENV);
    const { productId, fulfillment, quantity = 1 } = await req.json();

    // Get product
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
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

    // Build line items (NO manual shipping here)
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

    // Create payment link
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
            line_items: lineItems,

            // 🔥 THIS is what activates shipping properly
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
        }),
      }
    );

    if (!squareRes.ok) {
      const err = await squareRes.text();
      console.error("Square error:", err);
      return NextResponse.json(
        { error: "Checkout failed" },
        { status: 500 }
      );
    }

    const squareData = await squareRes.json();
    const paymentLink = squareData.payment_link;

    // Save order in Supabase
    await supabase.from("orders").insert({
      product_id: product.id,
      quantity,
      fulfillment_method: fulfillment,
      status: "created",
      square_payment_link_id: paymentLink.id,
      square_order_id: paymentLink.order_id,
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

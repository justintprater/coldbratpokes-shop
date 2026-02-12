import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
    const { productId } = await req.json();

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

    const response = await fetch(
      `${SQUARE_BASE_URL}/v2/online-checkout/payment-links`,
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
            redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/thank-you`,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Square error:", data);
      return NextResponse.json(
        { error: "Square checkout failed" },
        { status: 500 }
      );
    }

    await supabase.from("orders").insert({
      product_id: product.id,
      quantity: 1,
      fulfillment_method: "shipping",
      status: "created",
      square_payment_link_id: data.payment_link.id,
      square_order_id: data.payment_link.order_id,
    });

    return NextResponse.json({ url: data.payment_link.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

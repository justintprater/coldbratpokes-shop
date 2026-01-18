import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { productId } = await req.json();

    if (!productId) {
      return NextResponse.json(
        { error: "Missing productId" },
        { status: 400 }
      );
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!accessToken || !locationId || !siteUrl) {
      return NextResponse.json(
        { error: "Missing Square env vars" },
        { status: 500 }
      );
    }

    const isProd = process.env.SQUARE_ENV === "production";
    const baseUrl = isProd
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    // 1) Fetch product
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id,title,price_cents,status")
      .eq("id", productId)
      .single();

    if (!product || product.status !== "available") {
      return NextResponse.json(
        { error: "Product not available" },
        { status: 409 }
      );
    }

    // 2) Reserve product (10 minutes)
    const reservedUntil = new Date(
      Date.now() + 10 * 60 * 1000
    ).toISOString();

    await supabaseAdmin
      .from("products")
      .update({
        status: "reserved",
        reserved_until: reservedUntil,
      })
      .eq("id", product.id)
      .eq("status", "available");

    // 3) Create order row
    const { data: orderRow } = await supabaseAdmin
      .from("orders")
      .insert({
        product_id: product.id,
        status: "created",
      })
      .select("id")
      .single();

    if (!orderRow) {
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    const orderId = orderRow.id;

    // 4) Create Square PAYMENT LINK
    const body = {
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: product.title,
        price_money: {
          amount: product.price_cents,
          currency: "USD",
        },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: `${siteUrl}/thank-you?pid=${orderId}`,
      },
    };

    const resp = await fetch(
      `${baseUrl}/v2/online-checkout/payment-links`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      }
    );

    const json = await resp.json();

    if (!resp.ok || !json?.payment_link?.url) {
      return NextResponse.json(
        { error: "Square error", details: json },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: json.payment_link.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { productId } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!accessToken || !locationId || !siteUrl) {
      return NextResponse.json(
        { error: "Missing env vars: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, NEXT_PUBLIC_SITE_URL" },
        { status: 500 }
      );
    }

    const isProd = process.env.SQUARE_ENV === "production";
    const baseUrl = isProd
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    // 1) Fetch product from DB (don’t trust client price/title)
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id,title,price_cents,status")
      .eq("id", productId)
      .single();

    if (pErr || !product) {
      return NextResponse.json({ error: "Product not found", details: pErr }, { status: 404 });
    }

    if (product.status !== "available") {
      return NextResponse.json(
        { error: "Product not available", status: product.status },
        { status: 409 }
      );
    }

    // 2) Create an order row first
    const { data: orderRow, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({ product_id: product.id, status: "created" })
      .select("id")
      .single();

    if (oErr || !orderRow) {
      return NextResponse.json({ error: "Failed to create order", details: oErr }, { status: 500 });
    }

    const orderId = orderRow.id as string;

    // 3) Create Square payment link, redirect back to thank-you with orderId
    const idempotency_key = crypto.randomUUID();
    const redirect_url = `${siteUrl}/thank-you?pid=${encodeURIComponent(orderId)}`;

    const body = {
      idempotency_key,
      quick_pay: {
        name: product.title,
        price_money: { amount: product.price_cents, currency: "USD" },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url,
      },
    };

    const resp = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const json = await resp.json();

    if (!resp.ok) {
      // if Square fails, mark order failed
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json({ error: "Square error", details: json }, { status: resp.status });
    }

    const url = json?.payment_link?.url as string | undefined;
    const paymentLinkId = json?.payment_link?.id as string | undefined;
    const squareOrderId = json?.payment_link?.order_id as string | undefined;

    if (!url || !paymentLinkId) {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json(
        { error: "Square did not return payment_link.id/url", details: json },
        { status: 500 }
      );
    }

    // 4) Save Square ids onto our order row
    await supabaseAdmin
      .from("orders")
      .update({
        square_payment_link_id: paymentLinkId,
        square_order_id: squareOrderId ?? null,
      })
      .eq("id", orderId);

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

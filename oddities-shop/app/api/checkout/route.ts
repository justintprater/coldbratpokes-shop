export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY!);

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const signature =
    req.headers.get("x-square-hmacsha256-signature") || "";
  const body = await req.text();

  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl =
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;

  if (!key || !notificationUrl) {
    return NextResponse.json(
      { error: "Missing webhook env vars" },
      { status: 500 }
    );
  }

  // ✅ Compute expected signature (THIS WAS MISSING)
  const expected = crypto
    .createHmac("sha256", key)
    .update(notificationUrl + body)
    .digest("base64");

  if (!signature || !timingSafeEqual(signature, expected)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const payment = event?.data?.object?.payment;
  const paymentStatus = payment?.status;
  const paymentId = payment?.id;
  const squareOrderId = payment?.order_id;

  if (!payment || paymentStatus !== "COMPLETED" || !squareOrderId) {
    return NextResponse.json({ ok: true });
  }

  // Find our internal order
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      product_id,
      fulfillment_method
    `
    )
    .eq("square_order_id", squareOrderId)
    .single();

  if (!order) {
    return NextResponse.json({ ok: true });
  }

  // Mark order paid
  await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      square_payment_id: paymentId,
    })
    .eq("id", order.id);

  // Mark product sold
  await supabaseAdmin
    .from("products")
    .update({
      status: "sold",
      reserved_until: null,
    })
    .eq("id", order.product_id);

  // Send email
  await resend.emails.send({
    from: "Cold Brat Pokes <onboarding@resend.dev>",
    to: process.env.OWNER_EMAIL!,
    subject: "New Order",
    html: `
      <h3>New Order</h3>
      <p><strong>Fulfillment:</strong> ${order.fulfillment_method}</p>
      <p><strong>Square Order ID:</strong> ${squareOrderId}</p>
    `,
  });

  return NextResponse.json({ ok: true });
}

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

  // Verify Square signature
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

  if (!payment || payment.status !== "COMPLETED") {
    return NextResponse.json({ ok: true });
  }

  const paymentId = payment.id as string | undefined;
  const squareOrderId = payment.order_id as string | undefined;
  const buyerEmail = payment.buyer_email_address as string | undefined;
  const buyerName = payment.buyer_details?.name as string | undefined;

  if (!squareOrderId) {
    return NextResponse.json({ ok: true });
  }

  // ⛔ Explicitly type as any to bypass broken Supabase TS inference
  const { data: order }: { data: any } = await supabaseAdmin
    .from("orders")
    .select("id, product_id, fulfillment_method, products(title)")
    .eq("square_order_id", squareOrderId)
    .single();

  if (!order) {
    return NextResponse.json({ ok: true });
  }

  const productTitle =
    Array.isArray(order.products) && order.products.length > 0
      ? order.products[0].title
      : order.products?.title ?? "Unknown product";

  await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      square_payment_id: paymentId,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
    })
    .eq("id", order.id);

  await supabaseAdmin
    .from("products")
    .update({
      status: "sold",
      reserved_until: null,
    })
    .eq("id", order.product_id);

  if (process.env.OWNER_EMAIL && process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from: "Orders <orders@yourdomain.com>",
      to: process.env.OWNER_EMAIL,
      subject: "New order received",
      html: `
        <h3>New Order</h3>
        <p><strong>Product:</strong> ${productTitle}</p>
        <p><strong>Buyer:</strong> ${buyerName || "N/A"}</p>
        <p><strong>Email:</strong> ${buyerEmail || "N/A"}</p>
        <p><strong>Fulfillment:</strong> ${order.fulfillment_method}</p>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}

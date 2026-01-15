import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-square-hmacsha256-signature") || "";
  const body = await req.text();

  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;

  if (!key || !notificationUrl) {
    return NextResponse.json(
      { error: "Missing SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_NOTIFICATION_URL" },
      { status: 500 }
    );
  }

  // Square signs: base64( HMAC_SHA256(key, notificationUrl + body) )
  const expected = crypto
    .createHmac("sha256", key)
    .update(notificationUrl + body)
    .digest("base64");

  if (!signature || !timingSafeEqual(signature, expected)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Signature verified ✅
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // We care about payment updates completing
  const payment = event?.data?.object?.payment;
  const paymentStatus = payment?.status;
  const paymentId = payment?.id as string | undefined;
  const squareOrderId = payment?.order_id as string | undefined;

  // Always return 200 quickly if it’s not what we care about
  if (!payment || !paymentId || !squareOrderId) {
    return NextResponse.json({ ok: true });
  }

  if (paymentStatus !== "COMPLETED") {
    return NextResponse.json({ ok: true });
  }

  // Find our order by Square order id (we saved it from payment_link.order_id)
  const { data: order, error: findErr } = await supabaseAdmin
    .from("orders")
    .select("id, product_id, status")
    .eq("square_order_id", squareOrderId)
    .single();

  if (findErr || !order) {
    return NextResponse.json({ ok: true }); // don’t error-loop Square
  }

  // Mark order paid + store payment id
  await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      square_payment_id: paymentId,
    })
    .eq("id", order.id);

  // Mark product sold (only if it’s currently available)
  await supabaseAdmin
    .from("products")
    .update({ status: "sold" })
    .eq("id", order.product_id)
    .eq("status", "available");

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function verifySquareSignature(
  rawBody: string,
  signature: string | null
) {
  if (!signature) return false;

  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL!;
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!;

  const hmac = crypto.createHmac("sha256", signatureKey);

  // THIS IS THE CRITICAL PART
  hmac.update(notificationUrl + rawBody);

  const expectedSignature = hmac.digest("base64");

  return expectedSignature === signature;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-square-hmacsha256-signature");
  const rawBody = await req.text();

  if (!verifySquareSignature(rawBody, signature)) {
    console.error("Invalid Square signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.type !== "payment.updated") {
    return NextResponse.json({ received: true });
  }

  const payment = event.data.object.payment;

  if (payment.status !== "COMPLETED") {
    return NextResponse.json({ received: true });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("square_order_id", payment.order_id)
    .single();

  if (!order) {
    console.error("Order not found:", payment.order_id);
    return NextResponse.json({ received: true });
  }

  if (order.status === "paid") {
    return NextResponse.json({ received: true });
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      square_payment_id: payment.id,
    })
    .eq("id", order.id);

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", order.product_id)
    .single();

  const newQuantity = product.quantity_available - order.quantity;

  if (newQuantity <= 0) {
    await supabase
      .from("products")
      .update({
        quantity_available: 0,
        status: "sold",
      })
      .eq("id", product.id);
  } else {
    await supabase
      .from("products")
      .update({
        quantity_available: newQuantity,
      })
      .eq("id", product.id);
  }

  await resend.emails.send({
    from: process.env.OWNER_EMAIL!,
    to: process.env.OWNER_EMAIL!,
    subject: "New Order Received",
    html: `
      <h2>New Order</h2>
      <p>Product: ${product.title}</p>
      <p>Quantity: ${order.quantity}</p>
      <p>Fulfillment: ${order.fulfillment_method}</p>
      <p>Total Paid: $${(payment.amount_money.amount / 100).toFixed(2)}</p>
    `,
  });

  return NextResponse.json({ received: true });
}

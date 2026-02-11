import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function verifySquareSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;

  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL!;
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!;

  const hmac = crypto.createHmac("sha256", signatureKey);
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

  // 🔥 INVENTORY UPDATE
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

  // 🔥 BUYER INFO EXTRACTION (THE FIX)
  const buyerEmail = payment.buyer_email_address ?? "Not provided";

  const shipping = payment.shipping_address;
  const billing = payment.billing_address;

  const address = shipping || billing;

  const formattedAddress = address
    ? `
      ${address.address_line_1 ?? ""}
      ${address.address_line_2 ?? ""}
      ${address.locality ?? ""}
      ${address.administrative_district_level_1 ?? ""}
      ${address.postal_code ?? ""}
      ${address.country ?? ""}
    `
    : "No address provided";

  const totalPaid = (payment.amount_money.amount / 100).toFixed(2);

  // 🔥 EMAIL
  await resend.emails.send({
    from: "order@coldbratpokes.com",
    to: process.env.OWNER_EMAIL!,
    subject: "New Order Received",
    html: `
      <h2>New Order</h2>
      <p><strong>Product:</strong> ${product.title}</p>
      <p><strong>Quantity:</strong> ${order.quantity}</p>
      <p><strong>Fulfillment:</strong> ${order.fulfillment_method}</p>
      <p><strong>Total Paid:</strong> $${totalPaid}</p>
      <hr/>
      <h3>Customer Info</h3>
      <p><strong>Email:</strong> ${buyerEmail}</p>
      <p><strong>Address:</strong><br/>${formattedAddress}</p>
    `,
  });

  return NextResponse.json({ received: true });
}

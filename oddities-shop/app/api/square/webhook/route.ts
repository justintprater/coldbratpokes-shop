import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

const SQUARE_BASE_URL =
  process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

function verifySquareSignature(
  rawBody: string,
  signature: string | null
) {
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

  const { data: orderRecord } = await supabase
    .from("orders")
    .select("*")
    .eq("square_order_id", payment.order_id)
    .single();

  if (!orderRecord) {
    console.error("Order not found:", payment.order_id);
    return NextResponse.json({ received: true });
  }

  if (orderRecord.status === "paid") {
    return NextResponse.json({ received: true });
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      square_payment_id: payment.id,
    })
    .eq("id", orderRecord.id);

  // 🔥 Fetch FULL Square Order (this is the fix)
  const squareOrderRes = await fetch(
    `${SQUARE_BASE_URL}/v2/orders/${payment.order_id}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  const squareOrderData = await squareOrderRes.json();
  const squareOrder = squareOrderData.order;

  // Extract buyer email
  const buyerEmail =
    payment.buyer_email_address ||
    squareOrder?.customer_email ||
    "Not provided";

  // Extract shipping address
  const fulfillment = squareOrder?.fulfillments?.[0];
  const shippingAddress = fulfillment?.shipment_details?.recipient?.address;

  const formattedAddress = shippingAddress
    ? `
      ${shippingAddress.address_line_1 || ""}
      ${shippingAddress.locality || ""}, 
      ${shippingAddress.administrative_district_level_1 || ""} 
      ${shippingAddress.postal_code || ""}
      ${shippingAddress.country || ""}
    `
    : "No address provided";

  // Update inventory
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", orderRecord.product_id)
    .single();

  const newQuantity = product.quantity_available - orderRecord.quantity;

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
    from: "order@coldbratpokes.com",
    to: process.env.OWNER_EMAIL!,
    subject: "New Order Received",
    html: `
      <h2>New Order</h2>
      <p>Product: ${product.title}</p>
      <p>Quantity: ${orderRecord.quantity}</p>
      <p>Fulfillment: ${orderRecord.fulfillment_method}</p>
      <p>Total Paid: $${(payment.amount_money.amount / 100).toFixed(2)}</p>

      <hr />

      <h3>Customer Info</h3>
      <p>Email: ${buyerEmail}</p>
      <p>Address: ${formattedAddress}</p>
    `,
  });

  return NextResponse.json({ received: true });
}

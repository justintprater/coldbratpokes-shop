import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const rawBody = await req.text();

    const notificationUrl =
      "https://coldbratpokes-shop.vercel.app/api/square/webhook";

    const hmac = crypto.createHmac(
      "sha256",
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
    );

    hmac.update(notificationUrl + rawBody);
    const expectedSignature = hmac.digest("base64");

    if (signature !== expectedSignature) {
      console.error("Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.type !== "payment.updated") {
      return NextResponse.json({ received: true });
    }

    const payment = event.data.object.payment;

    if (payment.status !== "COMPLETED") {
      return NextResponse.json({ received: true });
    }

    const squareOrderId = payment.order_id;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("square_order_id", squareOrderId)
      .single();

    if (!order) {
      console.error("Order not found:", squareOrderId);
      return NextResponse.json({ received: true });
    }

    if (order.status === "paid") {
      return NextResponse.json({ received: true });
    }

    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
      })
      .eq("id", order.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

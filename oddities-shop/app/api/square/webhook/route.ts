import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const body = await req.text();

    const notificationUrl =
      "https://coldbratpokes-shop.vercel.app/api/square/webhook";

    const hmac = crypto.createHmac(
      "sha256",
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
    );

    // 🔥 THIS IS THE FIX
    hmac.update(notificationUrl + body);

    const hash = hmac.digest("base64");

    if (signature !== hash) {
      console.error("Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

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

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (items && items.length > 0) {
      for (const item of items) {
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("id", item.product_id)
          .single();

        if (!product) continue;

        const newQty = product.quantity_available - item.quantity;

        await supabaseAdmin
          .from("products")
          .update({
            quantity_available: newQty,
            status: newQty <= 0 ? "sold" : product.status,
          })
          .eq("id", item.product_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 401 });
    }

    // 🔐 MUST match your exact Square dashboard webhook URL
    const notificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/webhook`;

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

    if (!order) return NextResponse.json({ received: true });
    if (order.status === "paid") return NextResponse.json({ received: true });

    // ✅ Mark order paid
    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
      })
      .eq("id", order.id);

    // 🔽 Decrement inventory
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    let emailItemsHtml = "";

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

        emailItemsHtml += `
          <p>
            <strong>${product.title}</strong><br/>
            Quantity: ${item.quantity}<br/>
            Price: $${(product.price_cents / 100).toFixed(2)}
          </p>
        `;
      }
    }

    // 📧 Send Customer Email
    const customerEmail =
      payment.customer_details?.email_address || null;

    if (customerEmail) {
      await resend.emails.send({
        from: "ColdBratPokes <orders@yourdomain.com>",
        to: customerEmail,
        subject: "Your ColdBratPokes Order Confirmation",
        html: `
          <h2>Thank you for your purchase 🖤</h2>
          ${emailItemsHtml}
          <p>We’ll contact you shortly regarding fulfillment.</p>
        `,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

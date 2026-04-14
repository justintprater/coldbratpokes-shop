import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature")!;
    const body = await req.text();

    const hmac = crypto.createHmac(
      "sha256",
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
    );
    hmac.update(body);
    const digest = hmac.digest("base64");

    if (digest !== signature) {
      console.error("❌ Invalid webhook signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);

    console.log("🔥 WEBHOOK RECEIVED:", event.type);

    if (event.type !== "payment.updated") {
      return new Response("Ignored", { status: 200 });
    }

    const payment = event.data.object.payment;

    console.log("💳 PAYMENT STATUS:", payment.status);

    if (!["COMPLETED", "APPROVED"].includes(payment.status)) {
      return new Response("Not ready", { status: 200 });
    }

    const squareOrderId = payment.order_id;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("square_order_id", squareOrderId)
      .single();

    if (orderError || !order) {
      console.error("❌ Order not found:", orderError);
      return new Response("Order not found", { status: 404 });
    }

    // 🛑 Idempotency
    if (order.status === "paid") {
      console.log("⚠️ Already paid — skipping");
      return new Response("Already processed", { status: 200 });
    }

    if (order.status === "processing") {
      console.log("⚠️ Already processing — skipping");
      return new Response("Already processing", { status: 200 });
    }

    // 🔒 Lock order
    const { error: lockError } = await supabase
      .from("orders")
      .update({ status: "processing" })
      .eq("id", order.id);

    if (lockError) {
      console.error("❌ Failed to lock order:", lockError);
      return new Response("Lock failed", { status: 500 });
    }

    console.log("🔒 Order locked");

    // 🔍 Get items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (itemsError) {
      console.error("❌ Failed to fetch items:", itemsError);
      return new Response("Error", { status: 500 });
    }

    console.log("🧾 Items:", items);

    // 🔄 Update stock
    for (const item of items) {
      const { error: stockError } = await supabase.rpc("decrement_stock", {
        product_id_input: item.product_id,
        quantity_input: item.quantity,
      });

      if (stockError) {
        console.error("❌ Stock error:", stockError);

        await supabase
          .from("orders")
          .update({ status: "created" })
          .eq("id", order.id);

        return new Response("Stock error", { status: 500 });
      }

      console.log("✅ Stock updated:", item.product_id);
    }

    // ✅ Mark paid
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("❌ Update failed:", updateError);
      return new Response("Update failed", { status: 500 });
    }

    console.log("✅ Order marked paid");

    // 📧 EMAIL
    try {
      console.log("🚨 SENDING EMAIL");

      const meta = order.metadata || {};

      const emailRes = await resend.emails.send({
        // ✅ FIXED SENDER (NO NAME WRAPPING BUG)
        from: "orders@coldbratpokes.com",
        // 👉 once confirmed working, switch to:
        // from: "orders@coldbratpokes.com",

        to: process.env.OWNER_EMAIL!,
        subject: "New Order 💸",
        html: `
          <h2>New Order</h2>
          <p><b>Email:</b> ${meta.email || "N/A"}</p>
          <p><b>Instagram:</b> ${meta.instagram || "N/A"}</p>
          <p><b>Phone:</b> ${meta.phone || "N/A"}</p>
          <p><b>Delivery:</b> ${meta.isDelivery ? "Yes" : "Pickup"}</p>
          <p><b>Address:</b> ${meta.address || "N/A"}</p>
        `,
      });

      console.log("✅ EMAIL SENT:", emailRes);

    } catch (emailErr) {
      console.error("❌ EMAIL FAILED:", emailErr);
    }

    return new Response("Success", { status: 200 });

  } catch (err) {
    console.error("❌ Webhook crash:", err);
    return new Response("Server error", { status: 500 });
  }
}
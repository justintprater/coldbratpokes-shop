import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature")!;
    const body = await req.text();

    // ✅ Verify signature
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

    if (payment.status !== "COMPLETED") {
      return new Response("Not completed", { status: 200 });
    }

    const squareOrderId = payment.order_id;

    // 🔍 Find order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("square_order_id", squareOrderId)
      .single();

    if (orderError || !order) {
      console.error("❌ Order not found:", orderError);
      return new Response("Order not found", { status: 404 });
    }

    // 🛑 HARD IDEMPOTENCY
    if (order.status === "paid") {
      console.log("⚠️ Already paid — skipping");
      return new Response("Already processed", { status: 200 });
    }

    if (order.status === "processing") {
      console.log("⚠️ Already processing — skipping");
      return new Response("Already processing", { status: 200 });
    }

    // 🔒 LOCK ORDER (CRITICAL)
    const { error: lockError } = await supabase
      .from("orders")
      .update({ status: "processing" })
      .eq("id", order.id);

    if (lockError) {
      console.error("❌ Failed to lock order:", lockError);
      return new Response("Lock failed", { status: 500 });
    }

    console.log("🔒 Order locked");

    // 🔍 Get order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (itemsError) {
      console.error("❌ Failed to fetch order items:", itemsError);
      return new Response("Error", { status: 500 });
    }

    console.log("🧾 Order items:", items);

    // 🔄 Update stock (SAFE)
    for (const item of items) {
      const { error: stockError } = await supabase.rpc("decrement_stock", {
        product_id_input: item.product_id,
        quantity_input: item.quantity,
      });

      if (stockError) {
        console.error("❌ Stock update failed:", stockError);

        // 🔁 rollback lock (optional but good)
        await supabase
          .from("orders")
          .update({ status: "created" })
          .eq("id", order.id);

        return new Response("Stock error", { status: 500 });
      }

      console.log("✅ Stock updated:", item.product_id);
    }

    // ✅ Mark as paid
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("❌ Failed to update order:", updateError);
      return new Response("Update failed", { status: 500 });
    }

    console.log("✅ Order marked as paid");

    return new Response("Success", { status: 200 });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
}
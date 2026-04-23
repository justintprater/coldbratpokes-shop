import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  console.log("🟢 WEBHOOK START");

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
      console.error("❌ Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);

    console.log("📦 EVENT:", event.type);

    if (event.type !== "payment.updated") {
      return new Response("Ignored", { status: 200 });
    }

    const payment = event.data.object.payment;

    console.log("💳 STATUS:", payment.status);

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

    console.log("✅ Order:", order.id);

    // 🛑 Prevent duplicate emails ONLY if already paid
    if (order.status === "paid") {
      console.log("⚠️ Already paid — skipping");
      return new Response("Already processed", { status: 200 });
    }

    // 🔒 mark processing (non-blocking)
    await supabase
      .from("orders")
      .update({ status: "processing" })
      .eq("id", order.id);

    // 🔍 get items (non-blocking)
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (itemsError) {
      console.error("❌ Items fetch failed:", itemsError);
    } else {
      console.log("🧾 Items:", items);

      for (const item of items) {
        if (!item.product_id) {
          console.warn("⚠️ Skipping item with no product_id:", item);
          continue;
        }

        try {
          const { error: stockError } = await supabase.rpc(
            "decrement_stock",
            {
              product_id_input: item.product_id,
              quantity_input: item.quantity,
            }
          );

          if (stockError) {
            console.error("❌ Stock error:", stockError);
          } else {
            console.log("✅ Stock updated:", item.product_id);
          }
        } catch (err) {
          console.error("❌ Stock crash:", err);
        }
      }
    }

    // 💾 mark paid (non-blocking safety)
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("❌ Failed to mark paid:", updateError);
    } else {
      console.log("✅ Marked paid");
    }

    // 📧 EMAIL (GUARANTEED PATH)
    try {
      console.log("🚨 SENDING EMAIL");

      const meta = order.metadata || {};

      const emailRes = await resend.emails.send({
        from: "onboarding@resend.dev", // keep safe for now
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
    } catch (err) {
      console.error("❌ EMAIL FAILED:", err);
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("💥 WEBHOOK CRASH:", err);
    return new Response("Server error", { status: 500 });
  }
}
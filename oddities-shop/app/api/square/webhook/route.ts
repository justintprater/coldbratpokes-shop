import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  console.log("[webhook] >>> HANDLER ENTERED");
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const rawBody = await req.text();

    console.log("[webhook] received — signature present:", !!signature, "| body length:", rawBody.length);

    if (!signature) {
      console.error("[webhook] missing x-square-hmacsha256-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const notificationUrl =
      "https://coldbratpokes-shop.vercel.app/api/square/webhook";

    const hmac = crypto.createHmac(
      "sha256",
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
    );
    hmac.update(notificationUrl + rawBody);
    const expectedSignature = hmac.digest("base64");

    console.log("[webhook] signature check:", {
      received: signature,
      expected: expectedSignature,
      match: signature === expectedSignature,
    });

    if (signature !== expectedSignature) {
      console.error("[webhook] signature mismatch — check notificationUrl and SQUARE_WEBHOOK_SIGNATURE_KEY");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("[webhook] event type:", event.type);

    if (event.type !== "payment.updated") {
      console.log("[webhook] EARLY RETURN — event type not payment.updated, got:", event.type);
      return NextResponse.json({ received: true });
    }

    const payment = event.data?.object?.payment;
    console.log("[webhook] payment status:", payment?.status, "| order_id:", payment?.order_id);

    if (payment?.status !== "COMPLETED") {
      console.log("[webhook] EARLY RETURN — payment not COMPLETED, got:", payment?.status);
      return NextResponse.json({ received: true });
    }

    const squareOrderId = payment.order_id;

    const { data: order, error: orderLookupError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("square_order_id", squareOrderId)
      .single();

    if (orderLookupError) {
      console.error("[webhook] order lookup error:", orderLookupError);
    }

    if (!order) {
      console.error("[webhook] order not found for square_order_id:", squareOrderId);
      return NextResponse.json({ received: true });
    }

    if (order.status === "paid") {
      console.log("[webhook] order already paid, skipping:", order.id);
      return NextResponse.json({ received: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", square_payment_id: payment.id })
      .eq("id", order.id);

    if (updateError) {
      console.error("[webhook] failed to mark order paid:", updateError);
    } else {
      console.log("[webhook] order marked paid:", order.id);
    }

    // Decrement inventory and build email item list
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

    // Send confirmation email — failures are logged but don't fail the webhook
    const customerEmail =
      payment.buyer_email_address ??
      payment.shipping_address?.email_address ??
      null;

    console.log("[webhook] customer email resolved:", customerEmail ?? "(none)");

    if (customerEmail) {
      console.log("[webhook] >>> CALLING resend.emails.send() to:", customerEmail);
      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: "ColdBratPokes <orders@coldbratpokes.com>",
          to: customerEmail,
          subject: "Your ColdBratPokes Order Confirmation",
          html: `
            <h2>Thank you for your purchase!</h2>
            ${emailItemsHtml}
            <p>We'll be in touch shortly regarding fulfillment.</p>
          `,
        });

        console.log("[webhook] Resend response — data:", JSON.stringify(emailData), "| error:", JSON.stringify(emailError));

        if (emailError) {
          console.error("[webhook] Resend error:", emailError);
        } else {
          console.log("[webhook] Resend email sent, id:", emailData?.id);
        }
      } catch (emailErr) {
        console.error("[webhook] Resend threw:", emailErr);
      }
    } else {
      console.warn("[webhook] no customer email on payment — confirmation email skipped");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[webhook] unhandled error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";

const SQUARE_BASE =
  process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-square-hmacsha256-signature");
    const rawBody = await req.text();

    if (!signature) {
      console.error("[webhook] missing x-square-hmacsha256-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const notificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/square/webhook`;

    const hmac = crypto.createHmac(
      "sha256",
      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
    );
    hmac.update(notificationUrl + rawBody);
    const expectedSignature = hmac.digest("base64");

    if (signature !== expectedSignature) {
      console.error("[webhook] signature mismatch — check notificationUrl and SQUARE_WEBHOOK_SIGNATURE_KEY");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("[webhook] event type:", event.type);

    if (event.type !== "payment.updated") {
      return NextResponse.json({ received: true });
    }

    const payment = event.data?.object?.payment;
    console.log("[webhook] payment status:", payment?.status, "| order_id:", payment?.order_id);

    if (payment?.status !== "COMPLETED") {
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
      .select("product_id, quantity")
      .eq("order_id", order.id);

    let emailItemsHtml = "";

    if (items && items.length > 0) {
      for (const item of items) {
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("title, price_cents, quantity_available, status")
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
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${product.title}</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">$${(product.price_cents / 100).toFixed(2)}</td>
          </tr>
        `;
      }
    }

    const customerName = order.customer_name ?? null;
    const customerEmail = order.customer_email ?? payment.buyer_email_address ?? null;
    const customerInstagram = order.customer_instagram ?? null;

    console.log("[webhook] customer — name present:", !!customerName, "| email present:", !!customerEmail, "| instagram present:", !!customerInstagram);

    // Shipping address: Square stores it on the Order object when ask_for_shipping_address is used,
    // not on the Payment object. Try payment first (forward-compat), then fetch the order.
    let addr: Record<string, string | undefined> | null = payment.shipping_address ?? null;

    if (!addr && order.fulfillment_method === "shipping") {
      try {
        const squareOrderRes = await fetch(`${SQUARE_BASE}/v2/orders/${squareOrderId}`, {
          headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}` },
        });
        if (squareOrderRes.ok) {
          const squareOrderData = await squareOrderRes.json();
          addr = squareOrderData.order?.shipping_address ?? null;
          console.log("[webhook] shipping address from Square order:", !!addr);
        } else {
          console.error("[webhook] Square order fetch failed:", squareOrderRes.status);
        }
      } catch (orderFetchErr) {
        console.error("[webhook] failed to fetch Square order for address:", orderFetchErr);
      }
    }

    // Persist address to Supabase — fails gracefully if migration hasn't run yet
    if (addr && order.fulfillment_method === "shipping") {
      const { error: addrUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          shipping_address_line1: addr.address_line_1 ?? null,
          shipping_address_line2: addr.address_line_2 ?? null,
          shipping_city: addr.locality ?? null,
          shipping_state: addr.administrative_district_level_1 ?? null,
          shipping_postal_code: addr.postal_code ?? null,
        })
        .eq("id", order.id);

      if (addrUpdateError) {
        console.error("[webhook] address persist failed (migration needed?):", addrUpdateError.message);
      } else {
        console.log("[webhook] shipping address persisted for order:", order.id);
      }
    }

    const shippingAddressHtml = addr
      ? `
        <p style="margin: 2px 0;">${addr.address_line_1 ?? ""}${addr.address_line_2 ? `, ${addr.address_line_2}` : ""}</p>
        <p style="margin: 2px 0;">${addr.locality ?? ""}, ${addr.administrative_district_level_1 ?? ""} ${addr.postal_code ?? ""}</p>
      `
      : `<p style="margin: 2px 0; color: #999;">Not provided</p>`;

    const fulfillmentLabel =
      order.fulfillment_method === "pickup"
        ? "In-person pickup (free)"
        : "Delivery ($10 flat fee)";

    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "ColdBratPokes Orders <orders@coldbratpokes.com>",
        to: "coldbratpokes@gmail.com",
        subject: `New Order — ${customerName ?? customerEmail ?? "Unknown customer"}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #222; padding: 24px;">
            <h2 style="font-size: 22px; margin: 0 0 20px;">New Order Received</h2>

            <h3 style="font-size: 15px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #555;">Customer Info</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 6px 0; width: 130px; color: #555;">Name</td>
                <td style="padding: 6px 0;"><strong>${customerName ?? "—"}</strong></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #555;">Email</td>
                <td style="padding: 6px 0;"><a href="mailto:${customerEmail ?? ""}" style="color: #222;">${customerEmail ?? "—"}</a></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #555;">Instagram</td>
                <td style="padding: 6px 0;">${customerInstagram ?? "—"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #555;">Fulfillment</td>
                <td style="padding: 6px 0;">${fulfillmentLabel}</td>
              </tr>
              ${order.fulfillment_method !== "pickup" ? `
              <tr>
                <td style="padding: 6px 0; color: #555; vertical-align: top;">Ship to</td>
                <td style="padding: 6px 0;">${shippingAddressHtml}</td>
              </tr>
              ` : ""}
            </table>

            <h3 style="font-size: 15px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #555;">Items Ordered</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr style="border-bottom: 2px solid #222;">
                  <th style="text-align: left; padding-bottom: 8px;">Item</th>
                  <th style="text-align: center; padding-bottom: 8px;">Qty</th>
                  <th style="text-align: right; padding-bottom: 8px;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${emailItemsHtml}
              </tbody>
            </table>
          </div>
        `,
      });

      if (emailError) {
        console.error("[webhook] Resend error:", emailError);
      } else {
        console.log("[webhook] order notification sent, id:", emailData?.id);
      }
    } catch (emailErr) {
      console.error("[webhook] Resend threw:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[webhook] unhandled error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

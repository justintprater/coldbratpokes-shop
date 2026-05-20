import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SQUARE_BASE =
  process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const DELIVERY_FEE_CENTS = 1000;

export async function POST(req: Request) {
  try {
    const locationId = process.env.SQUARE_LOCATION_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!locationId || !siteUrl) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const { items, fulfillment = "shipping", customerInfo } = await req.json();

    console.log("[checkout] fulfillment:", fulfillment, "| email present:", !!customerInfo?.email);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    // First pass: validate stock and build line items, caching products to avoid re-fetching
    const lineItems: { name: string; quantity: string; base_price_money: { amount: number; currency: string } }[] = [];
    const productPriceCache = new Map<string, number>();

    for (const item of items) {
      const { productId, quantity = 1 } = item;

      const { data: product, error } = await supabaseAdmin
        .from("products")
        .select("id, title, price_cents, quantity_available, currency")
        .eq("id", productId)
        .single();

      if (error || !product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      if (product.quantity_available < quantity) {
        return NextResponse.json(
          { error: `${product.title} is out of stock` },
          { status: 400 }
        );
      }

      productPriceCache.set(productId, product.price_cents);

      lineItems.push({
        name: product.title,
        quantity: quantity.toString(),
        base_price_money: {
          amount: product.price_cents,
          currency: (product.currency || "USD").toUpperCase(),
        },
      });
    }

    // Delivery fee is an explicit line item so Square charges it
    if (fulfillment === "shipping") {
      lineItems.push({
        name: "Delivery",
        quantity: "1",
        base_price_money: { amount: DELIVERY_FEE_CENTS, currency: "USD" },
      });
    }

    const fulfillments =
      fulfillment === "pickup"
        ? [
            {
              type: "PICKUP",
              state: "PROPOSED",
              pickup_details: { schedule_type: "ASAP" },
            },
          ]
        : undefined;

    const paymentLinkPayload = {
      idempotency_key: randomUUID(),
      order: {
        location_id: locationId,
        line_items: lineItems,
        ...(fulfillments ? { fulfillments } : {}),
      },
      checkout_options: {
        redirect_url: `${siteUrl}/thank-you`,
        ask_for_shipping_address: fulfillment === "shipping",
      },
      ...(customerInfo?.email
        ? { pre_populated_data: { buyer_email: customerInfo.email } }
        : {}),
    };

    const createPaymentLinkRes = await fetch(
      `${SQUARE_BASE}/v2/online-checkout/payment-links`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentLinkPayload),
      }
    );

    const paymentLinkData = await createPaymentLinkRes.json();

    if (!createPaymentLinkRes.ok) {
      console.error("[checkout] Square error — status:", createPaymentLinkRes.status, "| body:", JSON.stringify(paymentLinkData));
      return NextResponse.json(
        { error: "Square payment link failed" },
        { status: 500 }
      );
    }

    const squareOrderId = paymentLinkData.related_resources?.orders?.[0]?.id;

    if (!squareOrderId) {
      console.error("[checkout] Square order ID missing from response");
      return NextResponse.json(
        { error: "Square order ID missing" },
        { status: 500 }
      );
    }

    const orderId = randomUUID();

    const { error: orderInsertError } = await supabaseAdmin
      .from("orders")
      .insert({
        id: orderId,
        square_order_id: squareOrderId,
        square_payment_link_id: paymentLinkData.payment_link.id,
        status: "created",
        fulfillment_method: fulfillment,
      });

    if (orderInsertError) {
      console.error("[checkout] order insert failed:", orderInsertError);
      return NextResponse.json({ error: "Order insert failed" }, { status: 500 });
    }

    // Store customer contact info. Requires customer_name/customer_email/customer_instagram
    // columns on the orders table. Fails gracefully if migration hasn't run yet.
    if (customerInfo?.name || customerInfo?.email || customerInfo?.instagram) {
      const { error: customerUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          customer_name: customerInfo.name ?? null,
          customer_email: customerInfo.email ?? null,
          customer_instagram: customerInfo.instagram ?? null,
        })
        .eq("id", orderId);

      if (customerUpdateError) {
        console.error("[checkout] customer info update failed (migration needed?):", customerUpdateError.message);
      } else {
        console.log("[checkout] customer info stored for order:", orderId);
      }
    }

    // Second pass: insert order items using cached prices — no extra Supabase queries
    const orderItemsInsert = items.map(({ productId, quantity = 1 }: { productId: string; quantity?: number }) => ({
      order_id: orderId,
      product_id: productId,
      quantity,
      price_cents: productPriceCache.get(productId)!,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsInsert);

    if (itemsError) {
      console.error("[checkout] order items insert failed:", itemsError);
      return NextResponse.json({ error: "Order items insert failed" }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl: paymentLinkData.payment_link.url });
  } catch (err) {
    console.error("[checkout] unhandled error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}

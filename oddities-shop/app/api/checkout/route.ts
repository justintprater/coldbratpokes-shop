import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SQUARE_BASE =
  process.env.SQUARE_ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

export async function POST(req: Request) {
  try {
    const locationId = process.env.SQUARE_LOCATION_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!locationId || !siteUrl) {
      console.error("Missing env variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { items, fulfillment = "shipping" } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const lineItems: any[] = [];

    for (const item of items) {
      const { productId, quantity = 1 } = item;

      const { data: product, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error || !product) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 }
        );
      }

      if (product.quantity_available < quantity) {
        return NextResponse.json(
          { error: `${product.title} is out of stock` },
          { status: 400 }
        );
      }

      lineItems.push({
        name: product.title,
        quantity: quantity.toString(),
        base_price_money: {
          amount: product.price_cents,
          currency: (product.currency || "USD").toUpperCase(),
        },
      });
    }

    const fulfillments =
      fulfillment === "shipping"
        ? [
            {
              type: "SHIPMENT",
              state: "PROPOSED",
              shipment_details: {
                recipient: {
                  display_name: "Customer",
                },
              },
            },
          ]
        : [
            {
              type: "PICKUP",
              state: "PROPOSED",
              pickup_details: {
                recipient: {
                  display_name: "Customer",
                },
                schedule_type: "ASAP",
              },
            },
          ];

    const createPaymentLinkRes = await fetch(
      `${SQUARE_BASE}/v2/online-checkout/payment-links`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: randomUUID(),
          order: {
            location_id: locationId,
            line_items: lineItems,
            fulfillments,
          },
          checkout_options: {
            redirect_url: `${siteUrl}/thank-you`,
            merchant_support_email: "support@coldbratpokes.com",
          },
        }),
      }
    );

    const paymentLinkData = await createPaymentLinkRes.json();

    if (!createPaymentLinkRes.ok) {
      console.error("Square payment link error:", paymentLinkData);
      return NextResponse.json(
        { error: "Square payment link failed" },
        { status: 500 }
      );
    }

    const paymentLinkUrl = paymentLinkData.payment_link.url;
    const paymentLinkId = paymentLinkData.payment_link.id;
    const squareOrderId = paymentLinkData.payment_link.order_id;

    const orderId = randomUUID();

    await supabaseAdmin.from("orders").insert({
      id: orderId,
      square_order_id: squareOrderId,
      square_payment_link_id: paymentLinkId,
      status: "created",
      fulfillment_method: fulfillment,
    });

    const orderItemsInsert = [];

    for (const item of items) {
      const { productId, quantity = 1 } = item;

      const { data: product } = await supabaseAdmin
        .from("products")
        .select("price_cents")
        .eq("id", productId)
        .single();

      orderItemsInsert.push({
        order_id: orderId,
        product_id: productId,
        quantity,
        price_cents: product!.price_cents,
      });
    }

    await supabaseAdmin.from("order_items").insert(orderItemsInsert);

    return NextResponse.json({
      checkoutUrl: paymentLinkUrl,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Client, Environment } from "square";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const square = new Client({
  environment:
    process.env.SQUARE_ENV === "production"
      ? Environment.Production
      : Environment.Sandbox,
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
});

const locationId = process.env.SQUARE_LOCATION_ID!;

export async function POST(req: Request) {
  try {
    const { items, fulfillment = "shipping" } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const lineItems: any[] = [];
    let totalAmount = 0;

    // Validate products and build Square line items
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

      const itemTotal = product.price_cents * quantity;
      totalAmount += itemTotal;

      lineItems.push({
        name: product.title,
        quantity: quantity.toString(),
        basePriceMoney: {
          amount: product.price_cents,
          currency: product.currency || "USD",
        },
      });
    }

    // Create Square order
    const squareOrder = await square.ordersApi.createOrder({
      order: {
        locationId,
        lineItems,
        fulfillments: [
          {
            type: "SHIPMENT",
            state: "PROPOSED",
          },
        ],
      },
      idempotencyKey: randomUUID(),
    });

    const squareOrderId = squareOrder.result.order?.id;

    // Create Square payment link
    const paymentLink = await square.checkoutApi.createPaymentLink({
      idempotencyKey: randomUUID(),
      order: {
        id: squareOrderId!,
      },
    });

    // Create parent order in Supabase
    const orderId = randomUUID();

    await supabaseAdmin.from("orders").insert({
      id: orderId,
      square_order_id: squareOrderId,
      square_payment_link_id: paymentLink.result.paymentLink?.id,
      status: "created",
      fulfillment_method: fulfillment,
    });

    // Insert order_items
    const orderItemsInsert = [];

    for (const item of items) {
      const { productId, quantity = 1 } = item;

      const { data: product } = await supabaseAdmin
        .from("products")
        .select("*")
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
      checkoutUrl: paymentLink.result.paymentLink?.url,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

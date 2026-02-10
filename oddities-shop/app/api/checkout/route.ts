import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SquareClient, Environment } from "square";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const square = new SquareClient({
  environment: Environment.Sandbox, // change to Production later
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const { productId, fulfillment } = await req.json();

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!product || product.status !== "available") {
      return NextResponse.json({ error: "Unavailable" }, { status: 400 });
    }

    // Reserve product
    await supabase
      .from("products")
      .update({
        status: "reserved",
        reserved_until: new Date(Date.now() + 15 * 60 * 1000),
      })
      .eq("id", product.id);

    // Create order
    const { data: order } = await supabase
      .from("orders")
      .insert({
        product_id: product.id,
        status: "created",
        fulfillment_method: fulfillment,
      })
      .select()
      .single();

    const checkout = await square.checkoutApi.createPaymentLink({
      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        lineItems: [
          {
            name: product.title,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(product.price_cents),
              currency: "USD",
            },
          },
        ],
      },
      checkoutOptions: {
        askForShippingAddress: fulfillment === "shipping",
      },
    });

    await supabase
      .from("orders")
      .update({
        square_payment_link_id: checkout.result.paymentLink?.id,
      })
      .eq("id", order.id);

    return NextResponse.json({
      url: checkout.result.paymentLink?.url,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}

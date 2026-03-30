import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("WEBHOOK RECEIVED:", JSON.stringify(body, null, 2));

    const event = body;

    if (event.type !== "payment.updated") {
      return NextResponse.json({ received: true });
    }

    const payment = event.data.object.payment;

    const orderId = payment.order_id;

    if (!orderId) {
      console.error("No order_id in payment");
      return NextResponse.json({ received: true });
    }

    // ✅ 1. Mark order as paid
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
      })
      .eq("square_order_id", orderId)
      .select()
      .single();

    if (orderError || !order) {
      console.error("ORDER UPDATE ERROR:", orderError);
      return NextResponse.json({ received: true });
    }

    console.log("ORDER MARKED PAID:", order.id);

    // ✅ 2. Get order items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (itemsError) {
      console.error("ORDER ITEMS ERROR:", itemsError);
      return NextResponse.json({ received: true });
    }

    console.log("ORDER ITEMS:", items);

    // ✅ 3. Update stock for each item
    for (const item of items) {
      const productId = item.product_id;
      const quantityPurchased = item.quantity;

      // get current stock
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("quantity_available")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        console.error("PRODUCT FETCH ERROR:", productError);
        continue;
      }

      const newQuantity = Math.max(
        0,
        product.quantity_available - quantityPurchased
      );

      // update product
      const updateData: any = {
        quantity_available: newQuantity,
      };

      // mark sold if 0
      if (newQuantity === 0) {
        updateData.status = "sold";
      }

      const { error: updateError } = await supabaseAdmin
        .from("products")
        .update(updateData)
        .eq("id", productId);

      if (updateError) {
        console.error("STOCK UPDATE ERROR:", updateError);
      } else {
        console.log(
          `UPDATED PRODUCT ${productId}: ${product.quantity_available} → ${newQuantity}`
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return NextResponse.json({ received: true });
  }
}
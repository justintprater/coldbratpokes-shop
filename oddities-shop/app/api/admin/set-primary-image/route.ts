import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { password, image_id, product_id } = await req.json().catch(() => ({}));

  if (!password || password !== process.env.ADMIN_UPLOAD_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!image_id || !product_id) {
    return NextResponse.json({ error: "Missing image_id or product_id" }, { status: 400 });
  }

  // Fetch target image's current sort_order
  const { data: target } = await supabaseAdmin
    .from("product_images")
    .select("sort_order")
    .eq("id", image_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (target.sort_order === 0) {
    return NextResponse.json({ success: true }); // already primary
  }

  // Find the current primary (sort_order = 0) for this product
  const { data: currentPrimary } = await supabaseAdmin
    .from("product_images")
    .select("id")
    .eq("product_id", product_id)
    .eq("sort_order", 0)
    .single();

  // Swap sort_orders
  if (currentPrimary) {
    await supabaseAdmin
      .from("product_images")
      .update({ sort_order: target.sort_order })
      .eq("id", currentPrimary.id);
  }

  const { error } = await supabaseAdmin
    .from("product_images")
    .update({ sort_order: 0 })
    .eq("id", image_id);

  if (error) {
    console.error("[set-primary-image] update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

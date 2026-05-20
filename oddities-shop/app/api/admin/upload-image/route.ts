import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const password = formData.get("password") as string;
    if (!password || password !== process.env.ADMIN_UPLOAD_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productId = formData.get("product_id") as string;
    const image = formData.get("image") as File;

    if (!productId || !image) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const fileExt = image.name.split(".").pop();
    const filePath = `${productId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("product-images")
      .upload(filePath, image, { contentType: image.type, upsert: false });

    if (uploadError) {
      console.error("[upload-image] storage error:", uploadError);
      return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("product-images")
      .getPublicUrl(filePath);

    // Find next sort_order (max existing + 1, or 0 if no images yet)
    const { data: existing } = await supabaseAdmin
      .from("product_images")
      .select("sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextSortOrder = existing && existing.length > 0
      ? (existing[0].sort_order as number) + 1
      : 0;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("product_images")
      .insert({ product_id: productId, url: publicUrlData.publicUrl, sort_order: nextSortOrder })
      .select("id, sort_order")
      .single();

    if (insertError || !inserted) {
      console.error("[upload-image] insert error:", insertError);
      return NextResponse.json({ error: "Failed to save image record" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      id: (inserted as { id: string; sort_order: number }).id,
      sort_order: (inserted as { id: string; sort_order: number }).sort_order,
    });
  } catch (err) {
    console.error("[upload-image] unhandled error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

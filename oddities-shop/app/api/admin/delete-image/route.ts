import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { password, image_id } = await req.json().catch(() => ({}));

  if (!password || password !== process.env.ADMIN_UPLOAD_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!image_id) {
    return NextResponse.json({ error: "Missing image_id" }, { status: 400 });
  }

  // Fetch the record first so we can delete from storage too
  const { data: img, error: fetchError } = await supabaseAdmin
    .from("product_images")
    .select("url")
    .eq("id", image_id)
    .single();

  if (fetchError || !img) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Extract storage path from public URL
  const storagePath = (img.url as string).split("/product-images/")[1];
  if (storagePath) {
    const { error: storageError } = await supabaseAdmin.storage
      .from("product-images")
      .remove([storagePath]);
    if (storageError) {
      console.error("[delete-image] storage removal failed (continuing):", storageError.message);
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("product_images")
    .delete()
    .eq("id", image_id);

  if (deleteError) {
    console.error("[delete-image] db delete error:", deleteError);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const password = formData.get("password") as string;
    if (!password || password !== process.env.ADMIN_UPLOAD_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const price = Number(formData.get("price"));
    const quantityRaw = formData.get("quantity");
    const quantity = quantityRaw ? Math.max(1, Number(quantityRaw)) : 1;
    const images = formData.getAll("image") as File[];

    if (!title || !price || images.length === 0) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .insert({
        title,
        description,
        slug: slugify(title),
        price_cents: Math.round(price * 100),
        status: "available",
        quantity_available: quantity,
      })
      .select()
      .single();

    if (productError || !product) {
      console.error("[create-product] insert error:", productError);
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }

    // Upload all images in order; first = sort_order 0 (primary)
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const fileExt = image.name.split(".").pop();
      const filePath = `${product.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("product-images")
        .upload(filePath, image, { contentType: image.type, upsert: false });

      if (uploadError) {
        console.error(`[create-product] storage error for image ${i}:`, uploadError);
        // Don't fail the whole product — partial images are OK
        continue;
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const { error: imageInsertError } = await supabaseAdmin
        .from("product_images")
        .insert({ product_id: product.id, url: publicUrlData.publicUrl, sort_order: i });

      if (imageInsertError) {
        console.error(`[create-product] image row insert error for image ${i}:`, imageInsertError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[create-product] unhandled error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

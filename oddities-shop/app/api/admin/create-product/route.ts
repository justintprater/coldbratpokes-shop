import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// simple slug helper
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // 🔐 PASSWORD CHECK
    const password = formData.get("password") as string;
    if (password !== process.env.ADMIN_UPLOAD_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 📦 FORM DATA
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const price = Number(formData.get("price"));
    const image = formData.get("image") as File;

    if (!title || !price || !image) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1️⃣ CREATE PRODUCT (NO IMAGE HERE)
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        title,
        description,
        slug: slugify(title),
        price_cents: Math.round(price * 100),
        status: "available",
      })
      .select()
      .single();

    if (productError) {
      console.error(productError);
      return NextResponse.json(
        { error: "Failed to create product" },
        { status: 500 }
      );
    }

    // 2️⃣ UPLOAD IMAGE TO STORAGE
    const fileExt = image.name.split(".").pop();
    const filePath = `${product.id}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, image, { contentType: image.type });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json(
        { error: "Image upload failed" },
        { status: 500 }
      );
    }

    // 3️⃣ GET PUBLIC URL
    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    // 4️⃣ INSERT INTO product_images TABLE
    const { error: imageInsertError } = await supabase
      .from("product_images")
      .insert({
        product_id: product.id,
        url: imageUrl,
        sort_order: 0,
      });

    if (imageInsertError) {
      console.error(imageInsertError);
      return NextResponse.json(
        { error: "Failed to save image" },
        { status: 500 }
      );
    }

    // ✅ DONE
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

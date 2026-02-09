import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const password = formData.get("password") as string;
    if (password !== process.env.ADMIN_UPLOAD_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const price = Number(formData.get("price"));
    const image = formData.get("image") as File;

    if (!title || !price || !image) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const fileExt = image.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, image, { contentType: image.type });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    const image_url = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from("products").insert({
      title,
      description,
      price,
      image_url,
      status: "available",
    });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

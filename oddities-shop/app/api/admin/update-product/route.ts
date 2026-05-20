import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json();
  const { id, password, title, description, price_cents, quantity_available, status } = body;

  if (!password || password !== process.env.ADMIN_UPLOAD_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (!["available", "hidden", "sold"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (typeof price_cents !== "number" || price_cents < 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  if (typeof quantity_available !== "number" || quantity_available < 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("products")
    .update({ title, description, price_cents, quantity_available, status })
    .eq("id", id);

  if (error) {
    console.error("[update-product] update failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

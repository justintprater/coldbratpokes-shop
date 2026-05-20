import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_EMAIL = "coldbratpokes@gmail.com";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");

  // Client auth already checked — this is DB safety only
  const { id, price, status } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (!["available", "hidden"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (typeof price !== "number" || price < 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("products")
    .update({ price, status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

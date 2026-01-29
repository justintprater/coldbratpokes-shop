"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminProductTable from "./product-table";

const ADMIN_EMAIL = "HER_EMAIL_HERE";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = "/";
        return;
      }

      setAuthorized(true);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProducts(data);
      }

      setLoading(false);
    }

    init();
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (!authorized) return null;

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin – Products</h1>
      <AdminProductTable products={products} />
    </div>
  );
}

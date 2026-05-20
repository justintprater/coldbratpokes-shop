"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProductTable, { type AdminProduct } from "./product-table";

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  marginBottom: 10,
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  color: "#f0f0f0",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#888",
  marginBottom: 4,
};

export default function AdminPage() {
  // Auth
  const [password, setPassword]     = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]   = useState("");

  // Product list
  const [products, setProducts]         = useState<AdminProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // New product form
  const createFormRef                     = useRef<HTMLFormElement>(null);
  const [newTitle, setNewTitle]           = useState("");
  const [newDesc, setNewDesc]             = useState("");
  const [newPrice, setNewPrice]           = useState("");
  const [newQty, setNewQty]               = useState("1");
  const [newImage, setNewImage]           = useState<File | null>(null);
  const [creating, setCreating]           = useState(false);
  const [createMsg, setCreateMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  async function handleLogin() {
    if (!password.trim()) return;
    setAuthLoading(true);
    setAuthError("");

    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setAuthorized(true);
      loadProducts();
    } else {
      setAuthError("Incorrect password. Please try again.");
    }
    setAuthLoading(false);
  }

  async function loadProducts() {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, title, description, price_cents, quantity_available, status, product_images(url)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin] product fetch error:", error);
    }
    setProducts((data as AdminProduct[]) ?? []);
    setLoadingProducts(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newImage) {
      setCreateMsg({ ok: false, text: "Please select an image." });
      return;
    }

    setCreating(true);
    setCreateMsg(null);

    const formData = new FormData();
    formData.append("password", password);
    formData.append("title", newTitle);
    formData.append("description", newDesc);
    formData.append("price", newPrice);
    formData.append("quantity", newQty);
    formData.append("image", newImage);

    const res = await fetch("/api/admin/create-product", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setCreateMsg({ ok: true, text: "Product published — it is now live in the shop." });
      setNewTitle("");
      setNewDesc("");
      setNewPrice("");
      setNewQty("1");
      setNewImage(null);
      createFormRef.current?.reset();
      await loadProducts();
    } else {
      const data = await res.json().catch(() => ({}));
      setCreateMsg({ ok: false, text: data.error ?? "Something went wrong — please try again." });
    }

    setCreating(false);
  }

  // ── Password gate ─────────────────────────────────────────────────────────

  if (!authorized) {
    return (
      <main style={{ padding: 40, maxWidth: 380 }}>
        <h1 style={{ marginBottom: 6 }}>Admin</h1>
        <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>ColdBratPokes store management</p>

        <span style={label}>Password</span>
        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          style={field}
        />
        <button
          onClick={handleLogin}
          disabled={authLoading}
          className="buyBtn"
          style={{ marginTop: 4 }}
        >
          {authLoading ? "Checking…" : "Enter"}
        </button>
        {authError && (
          <p style={{ marginTop: 12, color: "#ff6b6b", fontSize: 14 }}>{authError}</p>
        )}
      </main>
    );
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Admin — ColdBratPokes</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
            {loadingProducts ? "Loading…" : `${products.length} products`}
          </p>
        </div>
        <button
          onClick={() => { setAuthorized(false); setPassword(""); setProducts([]); }}
          style={{
            background: "none", border: "1px solid #333", color: "#777",
            padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13,
          }}
        >
          Log out
        </button>
      </div>

      {/* ── Add New Product ── */}
      <section
        style={{
          background: "#0d0d0d", border: "1px solid #222",
          borderRadius: 10, padding: 24, marginBottom: 44,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 17 }}>Add New Product</h2>

        <form ref={createFormRef} onSubmit={handleCreate}>
          <span style={label}>Title *</span>
          <input
            style={field}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Carved Skull Candle"
            required
          />

          <span style={label}>Description</span>
          <textarea
            style={{ ...field, height: 68, resize: "vertical" }}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Optional description shown on the product page"
          />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={label}>Price (USD) *</span>
              <input
                style={field}
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="24.99"
                required
              />
            </div>
            <div style={{ width: 110 }}>
              <span style={label}>Starting stock</span>
              <input
                style={field}
                type="number"
                min="1"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
              />
            </div>
          </div>

          <span style={label}>Product image *</span>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
            style={{ display: "block", marginBottom: 18, fontSize: 13, color: "#aaa" }}
          />

          <button
            type="submit"
            disabled={creating}
            className="buyBtn"
            style={{ width: "auto" }}
          >
            {creating ? "Publishing…" : "Publish product"}
          </button>

          {createMsg && (
            <p style={{ marginTop: 14, fontSize: 14, color: createMsg.ok ? "#4caf50" : "#ff6b6b" }}>
              {createMsg.ok ? "✓ " : "✗ "}{createMsg.text}
            </p>
          )}
        </form>
      </section>

      {/* ── Product list ── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Your products</h2>
          <button
            onClick={loadProducts}
            style={{
              background: "none", border: "1px solid #333", color: "#777",
              padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
            }}
          >
            Refresh
          </button>
        </div>

        {loadingProducts ? (
          <p style={{ color: "#555", fontSize: 14 }}>Loading products…</p>
        ) : products.length === 0 ? (
          <p style={{ color: "#555", fontSize: 14 }}>No products yet. Add one above to get started.</p>
        ) : (
          <ProductTable products={products} password={password} />
        )}
      </section>

    </main>
  );
}

"use client";

import { useState } from "react";

export type AdminProduct = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  quantity_available: number;
  status: "available" | "hidden" | "sold" | "reserved";
  product_images: { url: string | null }[] | null;
};

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "6px 10px",
  background: "#1a1a1a",
  border: "1px solid #2e2e2e",
  color: "#f0f0f0",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#666",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const STATUS_OPTIONS = [
  { value: "available", display: "Available for sale" },
  { value: "hidden",    display: "Hidden from shop" },
  { value: "sold",      display: "Sold" },
] as const;

const STATUS_COLOR: Record<string, string> = {
  available: "#4caf50",
  hidden:    "#666",
  sold:      "#ff9800",
  reserved:  "#9c7bff",
};

function ProductRow({
  product,
  password,
}: {
  product: AdminProduct;
  password: string;
}) {
  const initialStatus =
    product.status === "reserved" ? "available" : product.status;

  const [title, setTitle]       = useState(product.title);
  const [desc, setDesc]         = useState(product.description ?? "");
  const [dollars, setDollars]   = useState((product.price_cents / 100).toFixed(2));
  const [qty, setQty]           = useState(product.quantity_available);
  const [status, setStatus]     = useState<"available" | "hidden" | "sold">(
    initialStatus as "available" | "hidden" | "sold"
  );
  const [saving, setSaving]     = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgFeedback, setImgFeedback]   = useState<string | null>(null);
  const [imgUrl, setImgUrl]             = useState(
    product.product_images?.[0]?.url ?? null
  );

  async function handleSave() {
    setSaving(true);
    setSaveFeedback(null);

    const price_cents = Math.round(Number(dollars) * 100);
    if (isNaN(price_cents) || price_cents < 0) {
      setSaveFeedback({ ok: false, msg: "Invalid price" });
      setSaving(false);
      return;
    }

    const res = await fetch("/api/admin/update-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        password,
        title,
        description: desc,
        price_cents,
        quantity_available: Number(qty),
        status,
      }),
    });

    if (res.ok) {
      setSaveFeedback({ ok: true, msg: "Saved" });
      setTimeout(() => setSaveFeedback(null), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setSaveFeedback({ ok: false, msg: data.error ?? "Save failed" });
    }
    setSaving(false);
  }

  async function handleImageUpload() {
    if (!imageFile) return;
    setUploadingImg(true);
    setImgFeedback(null);

    const formData = new FormData();
    formData.append("password", password);
    formData.append("product_id", product.id);
    formData.append("image", imageFile);

    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setImgUrl(data.url);
      setImageFile(null);
      setImgFeedback("Image updated ✓");
      setTimeout(() => setImgFeedback(null), 3000);
    } else {
      setImgFeedback("Upload failed — try again");
    }
    setUploadingImg(false);
  }

  const statusColor   = STATUS_COLOR[status] ?? "#666";
  const originalColor = STATUS_COLOR[product.status] ?? "#666";

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        display: "flex",
        gap: 16,
      }}
    >
      {/* Thumbnail column */}
      <div style={{ flexShrink: 0, width: 92, display: "flex", flexDirection: "column", gap: 8 }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={title}
            style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 8, display: "block" }}
          />
        ) : (
          <div
            style={{
              width: 92, height: 92, borderRadius: 8, background: "#1a1a1a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "#444", textAlign: "center",
            }}
          >
            No image
          </div>
        )}
        <div
          style={{
            fontSize: 10, textAlign: "center", color: originalColor,
            textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
          }}
        >
          {product.status === "reserved" ? "Reserved" : product.status}
        </div>
      </div>

      {/* Edit fields */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>

        <div>
          <span style={label}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={field} />
        </div>

        <div>
          <span style={label}>Description</span>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="No description"
            style={{ ...field, height: 52, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={label}>Price (USD)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              style={field}
            />
          </div>
          <div style={{ width: 80 }}>
            <span style={label}>Stock</span>
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              style={field}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={label}>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "available" | "hidden" | "sold")}
              style={{ ...field, cursor: "pointer", color: statusColor }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.display}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image replacement */}
        <div>
          <span style={label}>Replace image</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 12, color: "#888", flex: 1 }}
            />
            {imageFile && (
              <button
                onClick={handleImageUpload}
                disabled={uploadingImg}
                style={{
                  padding: "5px 14px", fontSize: 12, background: "#1a1a1a",
                  border: "1px solid #444", color: "#ccc", borderRadius: 6, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {uploadingImg ? "Uploading…" : "Upload"}
              </button>
            )}
            {imgFeedback && (
              <span
                style={{
                  fontSize: 12,
                  color: imgFeedback.includes("failed") ? "#ff6b6b" : "#4caf50",
                }}
              >
                {imgFeedback}
              </span>
            )}
          </div>
        </div>

        {/* Save row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 22px", fontSize: 13, fontWeight: 600,
              background: saving ? "#1a1a1a" : "#fff",
              color: saving ? "#555" : "#000",
              border: "none", borderRadius: 6,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saveFeedback && (
            <span style={{ fontSize: 13, color: saveFeedback.ok ? "#4caf50" : "#ff6b6b" }}>
              {saveFeedback.ok ? "✓ Saved" : `✗ ${saveFeedback.msg}`}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}

const FILTERS = ["all", "available", "hidden", "sold"] as const;
type Filter = typeof FILTERS[number];

export default function ProductTable({
  products,
  password,
}: {
  products: AdminProduct[];
  password: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts: Record<Filter, number> = {
    all:       products.length,
    available: products.filter((p) => p.status === "available" && p.quantity_available > 0).length,
    hidden:    products.filter((p) => p.status === "hidden").length,
    sold:      products.filter((p) => p.status === "sold" || p.quantity_available <= 0).length,
  };

  const visible = products.filter((p) => {
    if (filter === "all")       return true;
    if (filter === "sold")      return p.status === "sold" || p.quantity_available <= 0;
    return p.status === filter;
  });

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px", fontSize: 13, borderRadius: 20,
              background: filter === f ? "#fff" : "#111",
              color: filter === f ? "#000" : "#888",
              border: `1px solid ${filter === f ? "#fff" : "#2e2e2e"}`,
              cursor: "pointer",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ color: "#555", fontSize: 14 }}>No products in this category.</p>
      ) : (
        visible.map((p) => (
          <ProductRow key={p.id} product={p} password={password} />
        ))
      )}
    </div>
  );
}

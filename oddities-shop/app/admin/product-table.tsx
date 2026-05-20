"use client";

import { useState } from "react";

export type AdminProduct = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  quantity_available: number;
  status: "available" | "hidden" | "sold" | "reserved";
  product_images: { id: string; url: string | null; sort_order: number }[] | null;
};

type ImageRecord = { id: string; url: string; sort_order: number };

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

  // Image management
  const [images, setImages] = useState<ImageRecord[]>(
    [...(product.product_images ?? [])]
      .filter((img): img is ImageRecord => Boolean(img.url))
      .sort((a, b) => a.sort_order - b.sort_order)
  );
  const [addImageFile, setAddImageFile]   = useState<File | null>(null);
  const [addingImage, setAddingImage]     = useState(false);
  const [imgFeedback, setImgFeedback]     = useState<string | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

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

  function flashImgFeedback(msg: string) {
    setImgFeedback(msg);
    setTimeout(() => setImgFeedback(null), 3500);
  }

  async function handleAddImage() {
    if (!addImageFile) return;
    setAddingImage(true);
    setImgFeedback(null);

    const formData = new FormData();
    formData.append("password", password);
    formData.append("product_id", product.id);
    formData.append("image", addImageFile);

    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setImages((prev) => [
        ...prev,
        { id: data.id, url: data.url, sort_order: data.sort_order },
      ]);
      setAddImageFile(null);
      flashImgFeedback("Image added ✓");
    } else {
      flashImgFeedback("Upload failed — try again");
    }
    setAddingImage(false);
  }

  async function handleDeleteImage(imageId: string) {
    if (!confirm("Delete this image?")) return;
    setDeletingId(imageId);

    const res = await fetch("/api/admin/delete-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, image_id: imageId }),
    });

    if (res.ok) {
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      flashImgFeedback("Image deleted ✓");
    } else {
      flashImgFeedback("Delete failed — try again");
    }
    setDeletingId(null);
  }

  async function handleSetPrimary(imageId: string) {
    setSettingPrimaryId(imageId);

    const res = await fetch("/api/admin/set-primary-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, image_id: imageId, product_id: product.id }),
    });

    if (res.ok) {
      setImages((prev) => {
        const target = prev.find((img) => img.id === imageId)!;
        const others = prev.filter((img) => img.id !== imageId);
        return [
          { ...target, sort_order: 0 },
          ...others.map((img, i) => ({ ...img, sort_order: i + 1 })),
        ];
      });
      flashImgFeedback("Primary image updated ✓");
    } else {
      flashImgFeedback("Failed — try again");
    }
    setSettingPrimaryId(null);
  }

  const statusColor = STATUS_COLOR[status] ?? "#666";
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
      {/* Primary thumbnail + status */}
      <div style={{ flexShrink: 0, width: 92, display: "flex", flexDirection: "column", gap: 8 }}>
        {images[0] ? (
          <img
            src={images[0].url}
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

        {/* ── Image management ── */}
        <div>
          <span style={label}>Images ({images.length})</span>

          {/* Existing image thumbnails */}
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {images.map((img, i) => (
                <div key={img.id} style={{ position: "relative", width: 76, flexShrink: 0 }}>
                  <img
                    src={img.url}
                    alt={`Image ${i + 1}`}
                    style={{
                      width: 76, height: 76, objectFit: "cover", borderRadius: 7, display: "block",
                      border: i === 0 ? "2px solid #ff4fd8" : "2px solid #2e2e2e",
                    }}
                  />
                  {/* Primary badge */}
                  {i === 0 && (
                    <div style={{
                      position: "absolute", top: 3, left: 3,
                      background: "rgba(255,79,216,0.85)", borderRadius: 4,
                      fontSize: 9, color: "#fff", padding: "1px 4px", fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}>
                      PRIMARY
                    </div>
                  )}
                  {/* Controls below thumbnail */}
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {i !== 0 && (
                      <button
                        onClick={() => handleSetPrimary(img.id)}
                        disabled={settingPrimaryId === img.id}
                        title="Set as primary"
                        style={{
                          flex: 1, fontSize: 10, padding: "2px 0",
                          background: "#1a1a1a", border: "1px solid #333",
                          color: "#aaa", borderRadius: 4, cursor: "pointer",
                        }}
                      >
                        {settingPrimaryId === img.id ? "…" : "★ Set"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      disabled={deletingId === img.id}
                      title="Delete image"
                      style={{
                        flex: 1, fontSize: 10, padding: "2px 0",
                        background: "#1a1a1a", border: "1px solid #333",
                        color: "#ff6b6b", borderRadius: 4, cursor: "pointer",
                      }}
                    >
                      {deletingId === img.id ? "…" : "✕ Del"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add image */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAddImageFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 12, color: "#888", flex: 1, minWidth: 0 }}
            />
            {addImageFile && (
              <button
                onClick={handleAddImage}
                disabled={addingImage}
                style={{
                  padding: "5px 14px", fontSize: 12, background: "#1a1a1a",
                  border: "1px solid #444", color: "#ccc", borderRadius: 6, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {addingImage ? "Uploading…" : "Add image"}
              </button>
            )}
          </div>

          {imgFeedback && (
            <p style={{
              marginTop: 6, fontSize: 12,
              color: imgFeedback.includes("failed") || imgFeedback.includes("Failed") ? "#ff6b6b" : "#4caf50",
            }}>
              {imgFeedback}
            </p>
          )}
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

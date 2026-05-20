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

type OrderItem = {
  title: string;
  quantity: number;
  price_cents: number;
};

type AdminOrder = {
  id: string;
  created_at: string;
  status: string;
  fulfillment_method: "shipping" | "pickup";
  customer_name: string | null;
  customer_email: string | null;
  customer_instagram: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  items: OrderItem[];
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "#666",
  paid:      "#4caf50",
  fulfilled: "#9c7bff",
  cancelled: "#ff6b6b",
};

const ORDER_FILTERS = ["all", "paid", "fulfilled", "pending"] as const;
type OrderFilter = typeof ORDER_FILTERS[number];

function OrderCard({
  order,
  password,
  onFulfilled,
}: {
  order: AdminOrder;
  password: string;
  onFulfilled: (id: string) => void;
}) {
  const [fulfilling, setFulfilling] = useState(false);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  const itemsTotal = order.items.reduce(
    (sum, i) => sum + i.price_cents * i.quantity,
    0
  );
  const deliveryFee = order.fulfillment_method === "shipping" ? 1000 : 0;
  const orderTotal = itemsTotal + deliveryFee;

  const shippingAddress =
    order.fulfillment_method === "shipping" && order.shipping_address_line1
      ? [
          order.shipping_address_line1,
          order.shipping_address_line2,
          `${order.shipping_city ?? ""}, ${order.shipping_state ?? ""} ${order.shipping_postal_code ?? ""}`.trim(),
        ]
          .filter(Boolean)
          .join(", ")
      : null;

  async function handleFulfill() {
    setFulfilling(true);
    setFulfillError(null);
    const res = await fetch("/api/admin/fulfill-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, order_id: order.id }),
    });
    if (res.ok) {
      onFulfilled(order.id);
    } else {
      const data = await res.json().catch(() => ({}));
      setFulfillError(data.error ?? "Failed");
    }
    setFulfilling(false);
  }

  const statusColor = STATUS_COLOR[order.status] ?? "#666";

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {order.customer_name ?? order.customer_email ?? "Unknown customer"}
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            {new Date(order.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
              hour: "numeric", minute: "2-digit",
            })}
          </div>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", color: statusColor, paddingTop: 2,
          }}
        >
          {order.status}
        </span>
      </div>

      {/* Customer info */}
      <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
        {order.customer_email && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "#666", marginRight: 6 }}>Email</span>
            <a href={`mailto:${order.customer_email}`} style={{ color: "#aaa" }}>
              {order.customer_email}
            </a>
          </div>
        )}
        {order.customer_instagram && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "#666", marginRight: 6 }}>Instagram</span>
            <span style={{ color: "#aaa" }}>{order.customer_instagram}</span>
          </div>
        )}
      </div>

      {/* Fulfillment */}
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: "#666", marginRight: 6 }}>Fulfillment</span>
        <span style={{ color: "#ccc" }}>
          {order.fulfillment_method === "pickup" ? "In-person pickup" : "Delivery"}
        </span>
        {shippingAddress && (
          <span style={{ color: "#888", marginLeft: 8 }}>— {shippingAddress}</span>
        )}
        {order.fulfillment_method === "shipping" && !order.shipping_address_line1 && (
          <span style={{ color: "#ff9800", marginLeft: 8 }}>— address not captured</span>
        )}
      </div>

      {/* Items */}
      {order.items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {order.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 13, color: "#ccc", padding: "3px 0",
                borderBottom: i < order.items.length - 1 ? "1px solid #1a1a1a" : "none",
              }}
            >
              <span>{item.title} × {item.quantity}</span>
              <span>${(item.price_cents / 100).toFixed(2)}</span>
            </div>
          ))}
          {deliveryFee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", padding: "3px 0" }}>
              <span>Delivery fee</span>
              <span>$10.00</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, padding: "6px 0 0" }}>
            <span>Total</span>
            <span>${(orderTotal / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Fulfill button */}
      {order.status === "paid" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleFulfill}
            disabled={fulfilling}
            style={{
              padding: "7px 18px", fontSize: 13, fontWeight: 600,
              background: fulfilling ? "#1a1a1a" : "#9c7bff",
              color: fulfilling ? "#555" : "#fff",
              border: "none", borderRadius: 6,
              cursor: fulfilling ? "not-allowed" : "pointer",
            }}
          >
            {fulfilling ? "Marking…" : "Mark fulfilled"}
          </button>
          {fulfillError && (
            <span style={{ fontSize: 13, color: "#ff6b6b" }}>{fulfillError}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  // Auth
  const [password, setPassword]     = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]   = useState("");

  // Product list
  const [products, setProducts]         = useState<AdminProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Orders
  const [orders, setOrders]           = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("paid");

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
      loadOrders();
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

  async function loadOrders() {
    setLoadingOrders(true);
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
    } else {
      console.error("[admin] order fetch failed");
    }
    setLoadingOrders(false);
  }

  function handleOrderFulfilled(orderId: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "fulfilled" } : o))
    );
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

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === "all") return true;
    return o.status === orderFilter;
  });

  const orderCounts: Record<OrderFilter, number> = {
    all:       orders.length,
    paid:      orders.filter((o) => o.status === "paid").length,
    fulfilled: orders.filter((o) => o.status === "fulfilled").length,
    pending:   orders.filter((o) => o.status === "pending").length,
  };

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Admin — ColdBratPokes</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
            {loadingProducts ? "Loading…" : `${products.length} products`}
            {" · "}
            {loadingOrders ? "Loading…" : `${orders.length} orders`}
          </p>
        </div>
        <button
          onClick={() => { setAuthorized(false); setPassword(""); setProducts([]); setOrders([]); }}
          style={{
            background: "none", border: "1px solid #333", color: "#777",
            padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13,
          }}
        >
          Log out
        </button>
      </div>

      {/* ── Orders ── */}
      <section style={{ marginBottom: 52 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Orders</h2>
          <button
            onClick={loadOrders}
            style={{
              background: "none", border: "1px solid #333", color: "#777",
              padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
            }}
          >
            Refresh
          </button>
        </div>

        {/* Order filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {ORDER_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setOrderFilter(f)}
              style={{
                padding: "5px 14px", fontSize: 13, borderRadius: 20,
                background: orderFilter === f ? "#fff" : "#111",
                color: orderFilter === f ? "#000" : "#888",
                border: `1px solid ${orderFilter === f ? "#fff" : "#2e2e2e"}`,
                cursor: "pointer",
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({orderCounts[f]})
            </button>
          ))}
        </div>

        {loadingOrders ? (
          <p style={{ color: "#555", fontSize: 14 }}>Loading orders…</p>
        ) : filteredOrders.length === 0 ? (
          <p style={{ color: "#555", fontSize: 14 }}>No orders in this category.</p>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              password={password}
              onFulfilled={handleOrderFulfilled}
            />
          ))
        )}
      </section>

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

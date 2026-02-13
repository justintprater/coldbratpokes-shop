"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type CartItem = {
  productId: string;
  quantity: number;
};

type Product = {
  id: string;
  title: string;
  price_cents: number;
  quantity_available: number;
  product_images?: { url: string | null }[] | null;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);
  const [fulfillment, setFulfillment] = useState<"shipping" | "pickup">(
    "shipping"
  );

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    setCart(stored);
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      if (cart.length === 0) return;

      const ids = cart.map((item) => item.productId);

      const { data } = await supabase
        .from("products")
        .select(
          `
          id,
          title,
          price_cents,
          quantity_available,
          product_images ( url )
        `
        )
        .in("id", ids);

      if (data) {
        const map: Record<string, Product> = {};
        data.forEach((p) => {
          map[p.id] = p as Product;
        });
        setProducts(map);
      }
    }

    fetchProducts();
  }, [cart]);

  function updateCart(newCart: CartItem[]) {
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
    window.dispatchEvent(new Event("storage"));
  }

  function removeItem(productId: string) {
    updateCart(cart.filter((item) => item.productId !== productId));
  }

  function changeQty(productId: string, delta: number) {
    const updated = cart.map((item) =>
      item.productId === productId
        ? {
            ...item,
            quantity: Math.max(
              1,
              Math.min(
                products[productId]?.quantity_available ?? item.quantity,
                item.quantity + delta
              )
            ),
          }
        : item
    );

    updateCart(updated);
  }

  async function handleCheckout() {
    if (cart.length === 0) return;

    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          fulfillment,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.error ?? "Checkout failed");
        setLoading(false);
        return;
      }

      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("storage"));

      window.location.href = json.checkoutUrl;
    } catch (err) {
      console.error(err);
      alert("Checkout error");
      setLoading(false);
    }
  }

  const total = cart.reduce((sum, item) => {
    const product = products[item.productId];
    if (!product) return sum;
    return sum + product.price_cents * item.quantity;
  }, 0);

  return (
    <main className="container">
      <h1>Your Cart</h1>

      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {cart.map((item) => {
            const product = products[item.productId];
            if (!product) return null;

            const imgUrl = product.product_images?.[0]?.url ?? null;

            return (
              <div
                key={item.productId}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                {imgUrl && (
                  <img
                    src={imgUrl}
                    alt={product.title}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{product.title}</div>
                  <div style={{ fontSize: 14, opacity: 0.7 }}>
                    ${(product.price_cents / 100).toFixed(2)}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <button onClick={() => changeQty(item.productId, -1)}>
                      -
                    </button>
                    <span style={{ margin: "0 10px" }}>
                      {item.quantity}
                    </span>
                    <button onClick={() => changeQty(item.productId, 1)}>
                      +
                    </button>
                  </div>
                </div>

                <button onClick={() => removeItem(item.productId)}>
                  Remove
                </button>
              </div>
            );
          })}

          <hr style={{ margin: "24px 0" }} />

          <div style={{ marginBottom: 16 }}>
            <label>
              <input
                type="radio"
                checked={fulfillment === "shipping"}
                onChange={() => setFulfillment("shipping")}
              />
              Ship to me ($10 flat)
            </label>

            <br />

            <label>
              <input
                type="radio"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
              />
              In-person pickup (free)
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Total: ${(total / 100).toFixed(2)}</strong>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="buyBtn"
          >
            {loading ? "Redirecting…" : "Checkout"}
          </button>
        </>
      )}
    </main>
  );
}

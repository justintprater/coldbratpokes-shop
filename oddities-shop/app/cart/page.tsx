"use client";

import { useEffect, useState } from "react";

type CartItem = {
  productId: string;
  quantity: number;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fulfillment, setFulfillment] = useState<"shipping" | "pickup">(
    "shipping"
  );

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    setCart(stored);
  }, []);

  function updateCart(newCart: CartItem[]) {
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  }

  function removeItem(productId: string) {
    const updated = cart.filter((item) => item.productId !== productId);
    updateCart(updated);
  }

  function changeQty(productId: string, delta: number) {
    const updated = cart.map((item) =>
      item.productId === productId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
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
      window.location.href = json.checkoutUrl;
    } catch (err) {
      console.error(err);
      alert("Checkout error");
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Your Cart</h1>

      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          {cart.map((item) => (
            <div
              key={item.productId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <div>{item.productId}</div>
                <div>Qty: {item.quantity}</div>
              </div>

              <div>
                <button onClick={() => changeQty(item.productId, -1)}>
                  -
                </button>
                <button onClick={() => changeQty(item.productId, 1)}>
                  +
                </button>
                <button onClick={() => removeItem(item.productId)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                checked={fulfillment === "shipping"}
                onChange={() => setFulfillment("shipping")}
              />
              Ship to me ($10 flat)
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <input
                type="radio"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
              />
              In-person pickup (free)
            </label>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="buyBtn"
            >
              {loading ? "Redirecting…" : "Checkout"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

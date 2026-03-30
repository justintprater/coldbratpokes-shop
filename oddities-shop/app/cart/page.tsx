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

      console.log("CHECKOUT RESPONSE:", json);

      if (!res.ok) {
        alert(json?.error ?? "Checkout failed");
        setLoading(false);
        return;
      }

      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("storage"));

      // ✅ THE FIX (THIS WAS WRONG BEFORE)
      if (!json.url) {
        console.error("Missing URL:", json);
        alert("Checkout failed");
        return;
      }

      window.location.href = json.url;
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
              <div key={item.productId}>
                <p>{product.title}</p>
                <p>Qty: {item.quantity}</p>
                <button onClick={() => changeQty(item.productId, 1)}>+</button>
                <button onClick={() => changeQty(item.productId, -1)}>-</button>
                <button onClick={() => removeItem(item.productId)}>
                  Remove
                </button>
              </div>
            );
          })}

          <h2>Total: ${(total / 100).toFixed(2)}</h2>

          <button onClick={handleCheckout} disabled={loading}>
            {loading ? "Processing..." : "Checkout"}
          </button>
        </>
      )}
    </main>
  );
}
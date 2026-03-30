"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [products, setProducts] = useState<any>({});
  const [loading, setLoading] = useState(false);

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
        .select("*")
        .in("id", ids);

      if (data) {
        const map: any = {};
        data.forEach((p) => {
          map[p.id] = p;
        });
        setProducts(map);
      }
    }

    fetchProducts();
  }, [cart]);

  async function handleCheckout() {
    if (cart.length === 0) return;

    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
        }),
      });

      const json = await res.json();

      console.log("CHECKOUT RESPONSE:", json);

      if (!json.url) {
        alert("Checkout failed");
        return;
      }

      // ✅ ONLY CHANGE THAT MATTERS
      window.location.href = json.url;

    } catch (err) {
      console.error(err);
      alert("Checkout error");
    } finally {
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
          {cart.map((item) => {
            const product = products[item.productId];
            if (!product) return null;

            return (
              <div key={item.productId}>
                <p>{product.title}</p>
                <p>Qty: {item.quantity}</p>
              </div>
            );
          })}

          <button onClick={handleCheckout} disabled={loading}>
            {loading ? "Processing..." : "Checkout"}
          </button>
        </>
      )}
    </main>
  );
}
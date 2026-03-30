"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type CartItem = {
  productId: string;
  quantity: number;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
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
        .select(`
          id,
          title,
          price_cents,
          quantity_available,
          product_images ( url )
        `)
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

      if (!res.ok || !json.url) {
        alert("Checkout failed");
        return;
      }

      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("storage"));

      // ✅ ONLY REAL FIX
      window.location.href = json.url;

    } catch (err) {
      console.error(err);
      alert("Checkout error");
    } finally {
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

            const imgUrl = product.product_images?.[0]?.url;

            return (
              <div key={item.productId}>
                {imgUrl && (
                  <img
                    src={imgUrl}
                    alt={product.title}
                    style={{ width: "100px" }}
                  />
                )}

                <p>{product.title}</p>
                <p>Qty: {item.quantity}</p>
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
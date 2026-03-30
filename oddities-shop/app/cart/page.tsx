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

      if (!res.ok || !json.url) {
        alert("Checkout failed");
        return;
      }

      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("storage"));

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
    <main className="max-w-2xl mx-auto px-6 py-16 text-white">
      <h1 className="text-2xl mb-8">Your Cart</h1>

      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <div className="space-y-6">
            {cart.map((item) => {
              const product = products[item.productId];
              if (!product) return null;

              const imgUrl = product.product_images?.[0]?.url;

              return (
                <div
                  key={item.productId}
                  className="flex items-center gap-5"
                >
                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt={product.title}
                      className="w-32 h-32 object-cover rounded-xl"
                    />
                  )}

                  <div>
                    <p className="text-lg font-semibold">
                      {product.title}
                    </p>
                    <p className="opacity-70">
                      Qty: {item.quantity}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10">
            <h2 className="text-lg mb-4">
              Total: ${(total / 100).toFixed(2)}
            </h2>

            {/* ✅ MATCHES YOUR PRODUCT PAGE BUTTON */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full rounded-xl border border-purple-500 bg-purple-500/10 py-3 font-medium text-white transition hover:bg-purple-500/20 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Checkout"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
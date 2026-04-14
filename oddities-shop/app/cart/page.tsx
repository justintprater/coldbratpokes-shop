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

  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [isDelivery, setIsDelivery] = useState(false);
  const [address, setAddress] = useState("");

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

  function removeFromCart(productId: string) {
    const updated = cart.filter((item) => item.productId !== productId);
    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;

    if (!email || !instagram) {
      alert("Email and Instagram are required");
      return;
    }

    if (isDelivery && !address) {
      alert("Address required for delivery");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        // ✅ FIXED HERE (FLAT STRUCTURE)
        body: JSON.stringify({
          items: cart,
          email,
          instagram,
          phone,
          isDelivery,
          address,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.url) {
        console.error("❌ Checkout failed:", json);
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

  const subtotal = cart.reduce((sum, item) => {
    const product = products[item.productId];
    if (!product) return sum;
    return sum + product.price_cents * item.quantity;
  }, 0);

  const deliveryFee = isDelivery ? 1000 : 0;
  const total = subtotal + deliveryFee;

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

                  <div className="flex-1">
                    <p className="text-lg font-semibold">
                      {product.title}
                    </p>

                    <p className="opacity-80">
                      ${(product.price_cents / 100).toFixed(2)}
                    </p>

                    <p className="opacity-70">
                      Qty: {item.quantity}
                    </p>

                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="mt-2 text-sm text-red-400 hover:text-red-300 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 space-y-4 bg-black/30 p-4 rounded-xl backdrop-blur-sm">
            <h2 className="text-lg">Contact Info</h2>

            <input
              placeholder="Email (required)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/20 text-white placeholder-white/50"
            />

            <input
              placeholder="Instagram (required)"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/20 text-white placeholder-white/50"
            />

            <input
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2 rounded bg-black/40 border border-white/20 text-white placeholder-white/50"
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDelivery}
                onChange={() => setIsDelivery(!isDelivery)}
              />
              Delivery (+$10)
            </label>

            {isDelivery && (
              <input
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 rounded bg-black/40 border border-white/20 text-white placeholder-white/50"
              />
            )}
          </div>

          <div className="mt-10">
            <p>Subtotal: ${(subtotal / 100).toFixed(2)}</p>
            <p>Delivery: ${(deliveryFee / 100).toFixed(2)}</p>

            <h2 className="text-lg mb-4">
              Total: ${(total / 100).toFixed(2)}
            </h2>

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
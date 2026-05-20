"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CartIndicator() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function update() {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const total = cart.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0
      );
      setCount(total);
    }

    update();
    window.addEventListener("storage", update);

    return () => window.removeEventListener("storage", update);
  }, []);

  return (
    <Link href="/cart" style={{ textDecoration: "none" }}>
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

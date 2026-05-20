"use client";

import { useEffect } from "react";

export function CartClearer() {
  useEffect(() => {
    localStorage.removeItem("cart");
    window.dispatchEvent(new Event("storage"));
  }, []);
  return null;
}

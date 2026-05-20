"use client";

import { useState } from "react";

type Product = {
  id: string;
  title: string;
  price: number;
  status: "available" | "hidden" | "reserved" | "sold";
};

export default function AdminProductTable({
  products,
}: {
  products: Product[];
}) {
  const [savingId, setSavingId] = useState<string | null>(null);

  async function save(product: Product) {
    setSavingId(product.id);

    await fetch("/api/admin/update-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: product.id,
        price: product.price,
        status: product.status,
      }),
    });

    setSavingId(null);
  }

  return (
    <table style={{ width: "100%", marginTop: 24 }}>
      <thead>
        <tr>
          <th align="left">Title</th>
          <th align="left">Price</th>
          <th align="left">Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id}>
            <td>{p.title}</td>

            <td>
              <input
                type="number"
                value={p.price}
                onChange={(e) => (p.price = Number(e.target.value))}
              />
            </td>

            <td>
              <select
                value={p.status}
                onChange={(e) =>
                  (p.status = e.target.value as "available" | "hidden")
                }
              >
                <option value="available">available</option>
                <option value="hidden">hidden</option>
              </select>
            </td>

            <td>
              <button
                onClick={() => save(p)}
                disabled={savingId === p.id}
              >
                {savingId === p.id ? "Saving…" : "Save"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

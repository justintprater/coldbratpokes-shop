"use client";

import { useState } from "react";

export default function AdminUploadPage() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    formData.append("password", password);

    const res = await fetch("/api/admin/create-product", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Error");
    } else {
      setMessage("Product uploaded!");
      e.currentTarget.reset();
    }

    setLoading(false);
  }

  if (!authorized) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin Access</h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => setAuthorized(true)}>Enter</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Upload Product</h1>

      <form onSubmit={handleSubmit}>
        <input name="title" placeholder="Title" required />
        <br /><br />
        <textarea name="description" placeholder="Description" />
        <br /><br />
        <input
          name="price"
          type="number"
          step="0.01"
          placeholder="Price"
          required
        />
        <br /><br />
        <input name="image" type="file" accept="image/*" required />
        <br /><br />
        <button disabled={loading}>
          {loading ? "Uploading..." : "Publish"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}

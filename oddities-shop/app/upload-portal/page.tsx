"use client";

import { useState } from "react";

export default function UploadPortalPage() {
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
      setMessage(data.error || "Upload failed");
    } else {
      setMessage("✅ Product uploaded successfully");
      e.currentTarget.reset();
    }

    setLoading(false);
  }

  // PASSWORD GATE
  if (!authorized) {
    return (
      <div style={{ padding: 40, maxWidth: 400 }}>
        <h1>Upload Portal</h1>
        <p>Enter admin password</p>

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />

        <button
          onClick={() => setAuthorized(true)}
          style={{ padding: "8px 16px" }}
        >
          Enter
        </button>
      </div>
    );
  }

  // UPLOAD FORM
  return (
    <div style={{ padding: 40, maxWidth: 500 }}>
      <h1>Upload Product</h1>

      <form onSubmit={handleSubmit}>
        <input
          name="title"
          placeholder="Item title"
          required
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />

        <textarea
          name="description"
          placeholder="Description"
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />

        <input
          name="price"
          type="number"
          step="0.01"
          placeholder="Price"
          required
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />

        <input
          name="image"
          type="file"
          accept="image/*"
          required
          style={{ marginBottom: 12 }}
        />

        <br />

        <button disabled={loading} style={{ padding: "8px 16px" }}>
          {loading ? "Uploading…" : "Publish"}
        </button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  );
}

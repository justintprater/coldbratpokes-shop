import { useState } from "react";

export default function UploadPortalPage() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    formData.append("password", password);

    const res = await fetch("/api/admin/create-product", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setMessage("✅ Product uploaded successfully — it is now live in the shop.");
      e.currentTarget.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setMessage("❌ Incorrect password — upload was not saved.");
      } else {
        setMessage(`❌ Upload failed: ${data.error ?? "Unknown error"}`);
      }
    }

    setLoading(false);
  }

  if (!authorized) {
    return (
      <div style={{ padding: 40, maxWidth: 400 }}>
        <h1>Upload Portal</h1>
        <p>Enter admin password</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setAuthorized(true); }}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />

        <button onClick={() => setAuthorized(true)}>
          Enter
        </button>
      </div>
    );
  }

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
          placeholder="Price (e.g. 24.99)"
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

        <button disabled={loading}>
          {loading ? "Uploading…" : "Publish"}
        </button>
      </form>

      {message && <p style={{ marginTop: 16 }}>{message}</p>}
    </div>
  );
}

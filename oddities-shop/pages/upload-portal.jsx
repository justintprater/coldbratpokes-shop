import { useState } from "react";

const ADMIN_UPLOAD_PASSWORD = "SpookiPunkinTiny1212";

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

    try {
      const res = await fetch("/api/admin/create-product", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      // ✅ TRUST API RESPONSE, NOT HTTP EDGE CASES
      if (data?.success) {
        setMessage("✅ Product uploaded successfully");
        e.currentTarget.reset();
      } else {
        setMessage(data?.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("Upload failed");
    }

    setLoading(false);
  }

  // 🔐 PASSWORD GATE
  if (!authorized) {
    return (
      <div style={{ padding: 40, maxWidth: 400 }}>
        <h1>Upload Portal</h1>
        <p>Enter admin password</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />

        <button
          onClick={() => {
            if (password === ADMIN_UPLOAD_PASSWORD) {
              setAuthorized(true);
            } else {
              alert("Incorrect password");
            }
          }}
        >
          Enter
        </button>
      </div>
    );
  }

  // 📦 UPLOAD FORM
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

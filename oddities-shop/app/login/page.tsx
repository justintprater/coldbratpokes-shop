"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div style={{ padding: 24 }}>
        <p>Check your email for the login link.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Login</h1>

      <input
        type="email"
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button onClick={login} style={{ marginLeft: 8 }}>
        Send login link
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

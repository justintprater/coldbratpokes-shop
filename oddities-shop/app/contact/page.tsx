import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="container" style={{ paddingTop: 32, paddingBottom: 80 }}>
      {/* Back link – aligned with site content */}
      <Link
        href="/"
        style={{
          color: "var(--muted)",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        ← Back to shop
      </Link>

      {/* Contact content */}
      <div
        style={{
          marginTop: 64,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--font-gothic)",
              fontSize: 36,
              letterSpacing: "0.06em",
              marginBottom: 16,
            }}
          >
            Contact Us
          </h1>

          <p
            style={{
              color: "var(--muted)",
              lineHeight: 1.7,
              marginBottom: 40,
            }}
          >
            Questions about an item, shipping, or commissions?
            <br />
            Reach out anytime — we’re happy to help.
          </p>

          <div>
            <p style={{ marginBottom: 24 }}>
              <strong>Email</strong>
              <br />
              <a
                href="mailto:coldbratpokes@gmail.com"
                style={{
                  color: "inherit",
                  textDecoration: "underline",
                }}
              >
                coldbratpokes@gmail.com
              </a>
            </p>

            <p>
              <strong>Instagram</strong>
              <br />
              <a
                href="https://instagram.com/coldbratpokes"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "inherit",
                  textDecoration: "underline",
                }}
              >
                @coldbratpokes
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

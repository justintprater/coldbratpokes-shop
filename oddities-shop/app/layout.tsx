import type { Metadata } from "next";
import { Cinzel_Decorative, Inter } from "next/font/google";
import Link from "next/link";
import CartIndicator from "./components/CartIndicator";
import "./globals.css";

/* Gothic display font for brand/title */
const gothic = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-gothic",
});

/* Clean readable font for everything else */
const clean = Inter({
  subsets: ["latin"],
  variable: "--font-clean",
});

export const metadata: Metadata = {
  title: "ColdBratPokes",
  description: "Oddities, engravings, apparel, and prints",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${gothic.variable} ${clean.variable}`}>
      <body className="antialiased">
        {/* Top Navigation */}
        <nav
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Left side (empty for balance) */}
          <div />

          {/* Center Brand */}
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-gothic)",
              fontSize: 22,
              letterSpacing: "0.04em",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            ColdBratPokes
          </Link>

          {/* Right side links */}
          <div
            style={{
              textAlign: "right",
              display: "flex",
              gap: 18,
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {/* Dynamic Cart Indicator */}
            <CartIndicator />

            <Link
              href="/contact"
              style={{
                fontSize: 14,
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              Contact Us
            </Link>
          </div>
        </nav>

        {children}

        {/* GLOBAL INSTAGRAM HANDLE (BOTTOM CENTER) */}
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 13,
            color: "var(--muted)",
            zIndex: 50,
            pointerEvents: "auto",
          }}
        >
          <a
            href="https://instagram.com/coldbratpokes"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "inherit",
              textDecoration: "none",
            }}
          >
            @coldbratpokes
          </a>
        </div>
      </body>
    </html>
  );
}

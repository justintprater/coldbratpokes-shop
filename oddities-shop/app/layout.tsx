import type { Metadata } from "next";
import { Cinzel_Decorative, Inter } from "next/font/google";
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
  title: "ColdBratPokes x Lalam0e",
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
        {children}
      </body>
    </html>
  );
}

import Link from "next/link";
import { CartClearer } from "../components/CartClearer";

export default function ThankYouPage() {
  return (
    <main className="container" style={{ paddingTop: 40 }}>
      <CartClearer />
      <h1 style={{ margin: 0, fontSize: 36 }}>Thank you 🖤</h1>

      <p style={{ color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
        Your order is confirmed. Check your email for a confirmation — and if
        you have any questions, DM or email us.
      </p>

      <div style={{ marginTop: 18 }}>
        <Link
          href="/"
          className="buyBtn"
          style={{ display: "inline-block", width: "auto" }}
        >
          Back to shop
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function ThankYouPage({
  searchParams,
}: {
  searchParams?: { pid?: string };
}) {
  return (
    <main className="container" style={{ paddingTop: 40 }}>
      <h1 style={{ margin: 0, fontSize: 36 }}>Thank you 🖤</h1>
      <p style={{ color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
        If your payment went through, you’ll also see it in Square. If you have any
        issues, DM or email us.
      </p>

      {searchParams?.pid ? (
        <p style={{ color: "var(--muted)", marginTop: 10, fontSize: 12 }}>
          Order ref: {searchParams.pid}
        </p>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <Link className="buyBtn" href="/" style={{ display: "inline-block", width: "auto" }}>
          Back to shop
        </Link>
      </div>
    </main>
  );
}

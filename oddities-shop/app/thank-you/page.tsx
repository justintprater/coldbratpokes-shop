import Link from "next/link";

<<<<<<< HEAD
export default function ThankYouPage() {
=======
export default function ThankYouPage({
  searchParams,
}: {
  searchParams?: { pid?: string };
}) {
>>>>>>> 99cd63b126b3f9bd24cbde79fc6b404b773c651a
  return (
    <main className="container" style={{ paddingTop: 40 }}>
      <h1 style={{ margin: 0, fontSize: 36 }}>Thank you 🖤</h1>

      <p style={{ color: "var(--muted)", marginTop: 10, lineHeight: 1.6 }}>
        If your payment went through, you’ll also see it in Square.
        If you have any issues, DM or email us.
      </p>

<<<<<<< HEAD
=======
      {searchParams?.pid && (
        <p style={{ color: "var(--muted)", marginTop: 10, fontSize: 12 }}>
          Order ref: {searchParams.pid}
        </p>
      )}

>>>>>>> 99cd63b126b3f9bd24cbde79fc6b404b773c651a
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

import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Not found</h1>
      <p className="lead">
        There is nothing here. <Link href="/">Back to the clips</Link>
      </p>
    </main>
  );
}

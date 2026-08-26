import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Hira home">
        Hira<span>.</span>
      </Link>
      <nav aria-label="Account navigation">
        <Link href="/properties">Find housing</Link>
        <Link href="/login">Sign in</Link>
        <Link className="button button-small" href="/register">
          Create account
        </Link>
      </nav>
    </header>
  );
}

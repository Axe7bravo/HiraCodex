import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function PublicPageShell({
  eyebrow,
  title,
  intro,
  children,
}: PublicPageShellProps) {
  return (
    <div className="public-info-page">
      <SiteHeader />
      <main>
        <header className="public-info-hero">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <div className="public-info-content">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

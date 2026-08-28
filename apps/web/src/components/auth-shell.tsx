import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Building2, Home, ShieldCheck } from "lucide-react";
import { SiteHeader } from "./site-header";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  copy: string;
  mode: "login" | "register";
  children: ReactNode;
};

export function AuthShell({ eyebrow, title, copy, mode, children }: AuthShellProps) {
  return (
    <main className={`auth-page auth-page-${mode}`}>
      <SiteHeader />
      <section className="auth-shell">
        <aside className="auth-visual" aria-label="Hira student housing">
          <div className="auth-visual-image">
            <Image
              src="/images/hira-students-maseru.png"
              alt="Two students near accommodation in Maseru"
              fill
              sizes="(max-width: 820px) 100vw, 48vw"
              priority
            />
          </div>
          <div className="auth-visual-overlay">
            <p><ShieldCheck aria-hidden="true" /> Built around trust</p>
            <h2>Student housing, made clearer.</h2>
            <ul>
              <li><BadgeCheck aria-hidden="true" /> Verified marketplace participants</li>
              <li><Home aria-hidden="true" /> Approved accommodation listings</li>
              <li><Building2 aria-hidden="true" /> Built for Maseru</li>
            </ul>
          </div>
        </aside>

        <div className="auth-form-column">
          <div className="auth-heading">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{copy}</p>
          </div>
          <div className="auth-card">{children}</div>
          <Link className="auth-back-home" href="/">Back to Hira home</Link>
        </div>
      </section>
    </main>
  );
}

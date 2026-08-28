import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomeLanding } from "./home-landing";

export const metadata: Metadata = {
  title: "Hira | Trusted student housing in Maseru",
  description:
    "Discover approved student accommodation in Maseru and connect with verified landlords.",
};

export default function Home() {
  return (
    <div className="home-page home-marketplace">
      <SiteHeader />
      <main>
        <HomeLanding />
      </main>
      <SiteFooter />
    </div>
  );
}

import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";
import "@/styles/landing.css";

export const metadata: Metadata = {
  title: "InVin · Invoicing app for freelancers",
  description: "Invoicing for creators, freelancers and small studios. Nine invoice designs, four currencies, and reminders and receipts that send themselves.",
  other: { "page-type": "software", "site-kind": "software" },
};

/* Signed-out visitors reach this at "/" (proxy.ts rewrites it); it is also public at /landing. */
export default function LandingPage() {
  return <Landing />;
}

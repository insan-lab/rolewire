import type { Metadata } from "next";

import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing in Bangladesh",
  description:
    "Rolewire pricing in BDT, paid with bKash, Nagad or card through UddoktaPay.",
  alternates: { canonical: "/pricing/bd" },
};

export const revalidate = 3600;

export default function BangladeshPricingPage() {
  return <PricingTable region="bd" />;
}

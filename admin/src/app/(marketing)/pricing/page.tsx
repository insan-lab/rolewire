import type { Metadata } from "next";

import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Flat monthly pricing for unlimited job posts and applications, billed in USD through Paddle.",
  alternates: { canonical: "/pricing" },
};

export const revalidate = 3600;

export default function PricingPage() {
  return <PricingTable region="global" />;
}

import type { Metadata } from "next";

import { StorageSettings } from "@/components/app/storage-settings";
import { PageHeader } from "@/components/ui/surface";
import { listStorageConfigs } from "@/lib/api/queries";

export const metadata: Metadata = { title: "Storage" };

export default async function StorageSettingsPage() {
  const configs = await listStorageConfigs().catch(() => []);

  return (
    <>
      <PageHeader
        title="Storage"
        description="Where uploaded résumés go when a job isn't using Rolewire's hosted storage."
      />
      <StorageSettings configs={configs} />
    </>
  );
}

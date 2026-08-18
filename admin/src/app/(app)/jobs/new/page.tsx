import type { Metadata } from "next";

import { JobWizard } from "@/components/app/job-wizard";
import { PageHeader } from "@/components/ui/surface";
import { listStorageConfigs } from "@/lib/api/queries";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage() {
  // Fetched server-side so the storage step can offer already-connected destinations as one click
  // instead of asking for credentials again (frontend spec §6.1 step 3).
  const storageConfigs = await listStorageConfigs().catch(() => []);

  return (
    <>
      <PageHeader
        title="New job"
        description="Four steps: the role, the questions, where files go, then a look at the exact API response."
      />
      <JobWizard storageConfigs={storageConfigs} />
    </>
  );
}

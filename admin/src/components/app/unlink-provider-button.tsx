"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { unlinkProviderAction } from "@/lib/actions";

export function UnlinkProviderButton({ provider, label }: { provider: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await unlinkProviderAction(provider);
    setPending(false);
    setOpen(false);
    if (!result.ok) {
      toast.error(`Couldn't unlink ${label}`, result.error);
      return;
    }
    toast.success(`${label} unlinked`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Unlink
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Unlink ${label}?`}
        description="You'll need another way to sign in — this is blocked if it's your only login method."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={pending} onClick={confirm}>
              Unlink
            </Button>
          </>
        }
      />
    </>
  );
}

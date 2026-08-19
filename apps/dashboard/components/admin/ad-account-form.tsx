"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import { createAdAccount } from "@/app/(dashboard)/admin/clients/actions";

interface AdAccountFormProps {
  clientId: string;
  limitReached: boolean;
  onCancel: () => void;
  onDone: () => void;
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

export function AdAccountForm({
  clientId,
  limitReached,
  onCancel,
  onDone,
}: AdAccountFormProps) {
  const router = useRouter();
  const { strings: t } = useDashboardLang();
  const [name, setName] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const canSave =
    name.trim().length > 0 &&
    !limitReached &&
    saveState.status !== "saving";

  function setString(
    setter: (value: string) => void
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event) => {
      setter(event.target.value);
      setSaveState({ status: "idle" });
    };
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveState({ status: "saving" });

    const result = await createAdAccount({
      clientId,
      name: name.trim(),
      status: "pending",
      source: "playwright",
      metaAdAccountId: metaAdAccountId.trim().length > 0 ? metaAdAccountId.trim() : null,
    });

    if (result.ok) {
      setSaveState({ status: "success" });
      router.refresh();
      onDone();
    } else {
      setSaveState({ status: "error", message: result.error });
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t.adAccountNew}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.clientCancel}
        </Button>
      </div>

      {limitReached && (
        <p className="text-sm text-destructive">
          {t.adAccountLimitReached}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="ad-account-name" className="text-sm font-medium text-muted-foreground">
            {t.clientNameLabel}
          </label>
          <input
            id="ad-account-name"
            value={name}
            onChange={setString(setName)}
            placeholder={t.adAccountNamePlaceholder}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ad-account-meta-id" className="text-sm font-medium text-muted-foreground">
            {t.adAccountMetaIdOptional}
          </label>
          <input
            id="ad-account-meta-id"
            value={metaAdAccountId}
            onChange={setString(setMetaAdAccountId)}
            placeholder={t.adAccountMetaIdPlaceholder}
            dir="ltr"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!canSave}>
          {saveState.status === "saving" ? t.clientCreateSaving : t.adAccountCreate}
        </Button>
        {saveState.status === "success" && (
          <p className="text-sm text-emerald-600">{t.adAccountCreated}</p>
        )}
        {saveState.status === "error" && (
          <p className="text-sm text-destructive">{saveState.message}</p>
        )}
      </div>
    </section>
  );
}
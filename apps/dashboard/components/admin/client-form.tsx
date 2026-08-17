"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { Package } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { createClient } from "@/app/(dashboard)/admin/clients/actions";

interface ClientFormProps {
  packages: Package[];
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

export function ClientForm({ packages, onCancel, onDone }: ClientFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const canSave =
    name.trim().length > 0 &&
    businessType.trim().length > 0 &&
    contactEmail.trim().length > 0 &&
    packageId.length > 0 &&
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

    const result = await createClient({
      name: name.trim(),
      businessType: businessType.trim(),
      contactEmail: contactEmail.trim(),
      packageId,
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
        <h2 className="text-base font-semibold">مشتری جدید</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          انصراف
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="client-name" className="text-sm font-medium text-muted-foreground">
            نام
          </label>
          <input
            id="client-name"
            value={name}
            onChange={setString(setName)}
            placeholder="مثلاً فروشگاه آنلاین آریا"
            className={inputClass}
          />
          {name.trim().length === 0 && saveState.status === "saving" && (
            <p className="text-xs text-destructive">نام نمی‌تواند خالی باشد.</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="client-business" className="text-sm font-medium text-muted-foreground">
            نوع کسب‌وکار
          </label>
          <input
            id="client-business"
            value={businessType}
            onChange={setString(setBusinessType)}
            placeholder="مثلاً فروشگاهی"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="client-email" className="text-sm font-medium text-muted-foreground">
            ایمیل تماس
          </label>
          <input
            id="client-email"
            type="email"
            value={contactEmail}
            onChange={setString(setContactEmail)}
            placeholder="client@example.com"
            dir="ltr"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="client-package" className="text-sm font-medium text-muted-foreground">
            پکیج
          </label>
          <select
            id="client-package"
            value={packageId}
            onChange={(event) => {
              setPackageId(event.target.value);
              setSaveState({ status: "idle" });
            }}
            className={inputClass}
          >
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!canSave}>
          {saveState.status === "saving" ? "در حال ذخیره..." : "ایجاد مشتری"}
        </Button>
        {saveState.status === "success" && (
          <p className="text-sm text-emerald-600">مشتری با موفقیت ایجاد شد.</p>
        )}
        {saveState.status === "error" && (
          <p className="text-sm text-destructive">{saveState.message}</p>
        )}
      </div>
    </section>
  );
}
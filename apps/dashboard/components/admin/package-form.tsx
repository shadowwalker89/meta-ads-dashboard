"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  DashboardKpiKey,
  PackageFeatures,
  PackagePricingDefaults,
  PricingMetric,
} from "@repo/shared";
import {
  DEFAULT_PACKAGE_FEATURES,
  DEFAULT_VISIBLE_KPIS,
  KPI_CATALOG,
  KPI_CATALOG_BY_KEY,
  KPI_GROUPS,
  PRICABLE_METRICS,
} from "@repo/shared";
import { Button } from "@/components/ui/button";
import {
  createPackage,
  updatePackage,
} from "@/app/(dashboard)/admin/packages/actions";
import type { PackageSettingsInput } from "@/lib/package-admin";

interface PackageFormProps {
  mode: "create" | "edit";
  packageId?: string;
  initial?: PackageSettingsInput | null;
  onCancel: () => void;
  onDone: () => void;
}

type PricingDraft = Record<PricingMetric, {
  percentageMarkup: string;
  fixedMarkup: string;
  minimumCustomerValue: string;
}>;

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function pricingFromDraft(draft: PricingDraft): PackagePricingDefaults {
  const defaults: PackagePricingDefaults = {};
  for (const metric of PRICABLE_METRICS) {
    const parts = draft[metric];
    const percentageMarkup = numberOrNull(parts.percentageMarkup);
    const fixedMarkup = numberOrNull(parts.fixedMarkup);
    const minimumCustomerValue = numberOrNull(parts.minimumCustomerValue);
    if (
      percentageMarkup !== null ||
      fixedMarkup !== null ||
      minimumCustomerValue !== null
    ) {
      defaults[metric] = {
        percentageMarkup: percentageMarkup !== null ? percentageMarkup / 100 : null,
        fixedMarkup,
        minimumCustomerValue,
      };
    }
  }
  return defaults;
}

function pricingToDraft(input: PackagePricingDefaults | undefined): PricingDraft {
  const draft = {} as PricingDraft;
  for (const metric of PRICABLE_METRICS) {
    const config = input?.[metric];
    draft[metric] = {
      percentageMarkup:
        config?.percentageMarkup !== null && config?.percentageMarkup !== undefined
          ? String(Math.round(config.percentageMarkup * 100))
          : "",
      fixedMarkup:
        config?.fixedMarkup !== null && config?.fixedMarkup !== undefined
          ? String(config.fixedMarkup)
          : "",
      minimumCustomerValue:
        config?.minimumCustomerValue !== null && config?.minimumCustomerValue !== undefined
          ? String(config.minimumCustomerValue)
          : "",
    };
  }
  return draft;
}

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

export function PackageForm({
  mode,
  packageId,
  initial,
  onCancel,
  onDone,
}: PackageFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [collectionFrequency, setCollectionFrequency] = useState(
    initial ? String(initial.collectionFrequency) : "1"
  );
  const [maxAdAccounts, setMaxAdAccounts] = useState(
    initial?.maxAdAccounts !== null && initial?.maxAdAccounts !== undefined
      ? String(initial.maxAdAccounts)
      : ""
  );
  const [maxCampaigns, setMaxCampaigns] = useState(
    initial?.maxCampaigns !== null && initial?.maxCampaigns !== undefined
      ? String(initial.maxCampaigns)
      : ""
  );
  const [retentionDays, setRetentionDays] = useState(
    initial?.retentionDays !== null && initial?.retentionDays !== undefined
      ? String(initial.retentionDays)
      : ""
  );
  const [visibleKpis, setVisibleKpis] = useState<DashboardKpiKey[]>(
    initial ? [...initial.defaultVisibleKpis] : [...DEFAULT_VISIBLE_KPIS]
  );
  const [features, setFeatures] = useState<PackageFeatures>(
    initial ? { ...initial.features } : { ...DEFAULT_PACKAGE_FEATURES }
  );
  const [pricing, setPricing] = useState<PricingDraft>(() =>
    pricingToDraft(initial?.pricingDefaults)
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const codeValid = code.trim().length > 0;
  const frequencyNumber = numberOrNull(collectionFrequency);
  const frequencyValid =
    frequencyNumber !== null &&
    Number.isInteger(frequencyNumber) &&
    frequencyNumber > 0;
  const canSave = codeValid && frequencyValid && saveState.status !== "saving";

  function setString(
    setter: (value: string) => void
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event) => {
      setter(event.target.value);
      setSaveState({ status: "idle" });
    };
  }

  function toggleKpi(key: DashboardKpiKey) {
    setVisibleKpis((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
    );
    setSaveState({ status: "idle" });
  }

  function toggleFeature(key: keyof PackageFeatures) {
    setFeatures((current) => ({ ...current, [key]: !current[key] }));
    setSaveState({ status: "idle" });
  }

  function setPricingField(
    metric: PricingMetric,
    field: keyof PricingDraft[PricingMetric]
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event) => {
      setPricing((current) => ({
        ...current,
        [metric]: { ...current[metric], [field]: event.target.value },
      }));
      setSaveState({ status: "idle" });
    };
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveState({ status: "saving" });

    const input: PackageSettingsInput = {
      name: name.trim(),
      description: description.trim(),
      code: code.trim(),
      collectionFrequency: frequencyNumber as number,
      maxAdAccounts: numberOrNull(maxAdAccounts),
      maxCampaigns: numberOrNull(maxCampaigns),
      retentionDays: numberOrNull(retentionDays),
      defaultVisibleKpis: [...visibleKpis],
      features: { ...features },
      pricingDefaults: pricingFromDraft(pricing),
    };

    const result =
      mode === "create"
        ? await createPackage(input)
        : await updatePackage(packageId as string, input);

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
        <h2 className="text-base font-semibold">
          {mode === "create" ? "پکیج جدید" : `ویرایش پکیج ${initial?.name ?? ""}`}
        </h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          انصراف
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="pkg-name" className="text-sm font-medium text-muted-foreground">
            نام
          </label>
          <input id="pkg-name" value={name} onChange={setString(setName)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pkg-code" className="text-sm font-medium text-muted-foreground">
            کد پکیج
          </label>
          <input
            id="pkg-code"
            value={code}
            onChange={setString(setCode)}
            placeholder="مثلاً premium"
            className={inputClass}
          />
          {!codeValid && (
            <p className="text-xs text-destructive">کد پکیج نمی‌تواند خالی باشد.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pkg-description" className="text-sm font-medium text-muted-foreground">
          توضیحات
        </label>
        <input
          id="pkg-description"
          value={description}
          onChange={setString(setDescription)}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="pkg-frequency" className="text-sm font-medium text-muted-foreground">
            دفعات جمع‌آوری در روز
          </label>
          <input
            id="pkg-frequency"
            type="number"
            min="1"
            step="1"
            value={collectionFrequency}
            onChange={setString(setCollectionFrequency)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pkg-max-accounts" className="text-sm font-medium text-muted-foreground">
            حداکثر اکانت تبلیغاتی
          </label>
          <input
            id="pkg-max-accounts"
            type="number"
            min="0"
            step="1"
            value={maxAdAccounts}
            onChange={setString(setMaxAdAccounts)}
            placeholder="خالی = نامحدود"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pkg-max-campaigns" className="text-sm font-medium text-muted-foreground">
            حداکثر کمپین
          </label>
          <input
            id="pkg-max-campaigns"
            type="number"
            min="0"
            step="1"
            value={maxCampaigns}
            onChange={setString(setMaxCampaigns)}
            placeholder="خالی = نامحدود"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="pkg-retention" className="text-sm font-medium text-muted-foreground">
            نگهداری داده (روز)
          </label>
          <input
            id="pkg-retention"
            type="number"
            min="0"
            step="1"
            value={retentionDays}
            onChange={setString(setRetentionDays)}
            placeholder="خالی = نامحدود"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-semibold">KPI پیش‌فرض</legend>
          {KPI_GROUPS.map((group) => {
            const groupKpis = KPI_CATALOG.filter((def) => def.group === group.key);
            return (
              <div key={group.key} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                {groupKpis.map((definition) => (
                  <label
                    key={definition.key}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKpis.includes(definition.key)}
                      onChange={() => toggleKpi(definition.key)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    {definition.label}
                  </label>
                ))}
              </div>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <legend className="px-2 text-sm font-semibold">امکانات</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={features.charts}
                onChange={() => toggleFeature("charts")}
                className="size-4 rounded border-border accent-primary"
              />
              نمودار
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={features.dataExport}
                onChange={() => toggleFeature("dataExport")}
                className="size-4 rounded border-border accent-primary"
              />
              خروجی داده
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={features.advancedReporting}
                onChange={() => toggleFeature("advancedReporting")}
                className="size-4 rounded border-border accent-primary"
              />
              گزارش پیشرفته
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <legend className="px-2 text-sm font-semibold">پیش‌فرض قیمت‌گذاری</legend>
            {PRICABLE_METRICS.map((metric) => (
              <div key={metric} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {KPI_CATALOG_BY_KEY.get(metric)?.label ?? metric}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={pricing[metric].percentageMarkup}
                    onChange={setPricingField(metric, "percentageMarkup")}
                    placeholder="٪ افزایش"
                    aria-label={`${metric} درصد افزایش`}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={pricing[metric].fixedMarkup}
                    onChange={setPricingField(metric, "fixedMarkup")}
                    placeholder="افزایش ثابت"
                    aria-label={`${metric} افزایش ثابت`}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={pricing[metric].minimumCustomerValue}
                    onChange={setPricingField(metric, "minimumCustomerValue")}
                    placeholder="حداقل"
                    aria-label={`${metric} حداقل ارزش`}
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </fieldset>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!canSave}>
          {saveState.status === "saving" ? "در حال ذخیره..." : "ذخیره پکیج"}
        </Button>
        {saveState.status === "success" && (
          <p className="text-sm text-emerald-600">پکیج با موفقیت ذخیره شد.</p>
        )}
        {saveState.status === "error" && (
          <p className="text-sm text-destructive">{saveState.message}</p>
        )}
      </div>
    </section>
  );
}
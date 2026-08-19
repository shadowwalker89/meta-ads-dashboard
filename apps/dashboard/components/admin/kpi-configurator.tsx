"use client";

import { useState } from "react";
import type { DashboardKpiKey } from "@repo/shared";
import {
  KPI_CATALOG,
  KPI_GROUPS,
  DEFAULT_VISIBLE_KPIS,
} from "@repo/shared";
import { Button } from "@/components/ui/button";
import { useDashboardLang } from "@/components/layout/language-provider";
import {
  getAdminKpiTitle,
  KPI_GROUP_LABELS_EN,
} from "@/lib/i18n/strings";
import { saveClientKpiConfig } from "@/app/(dashboard)/admin/kpi-config/actions";

interface KpiConfiguratorProps {
  clients: { id: string; name: string }[];
  configs: Record<string, DashboardKpiKey[]>;
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

export function KpiConfigurator({ clients, configs }: KpiConfiguratorProps) {
  const { strings: t } = useDashboardLang();
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id ?? ""
  );
  const [selectedKeys, setSelectedKeys] = useState<DashboardKpiKey[]>(
    configs[selectedClientId] ?? [...DEFAULT_VISIBLE_KPIS]
  );
  const [savedKeys, setSavedKeys] = useState<DashboardKpiKey[]>(
    configs[selectedClientId] ?? [...DEFAULT_VISIBLE_KPIS]
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  if (clients.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
        {t.kpiConfigNoAssigned}
      </div>
    );
  }

  function handleClientChange(clientId: string) {
    const initial = configs[clientId] ?? [...DEFAULT_VISIBLE_KPIS];
    setSelectedClientId(clientId);
    setSelectedKeys(initial);
    setSavedKeys(initial);
    setSaveState({ status: "idle" });
  }

  function toggleKpi(key: DashboardKpiKey) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
    );
    setSaveState({ status: "idle" });
  }

  async function handleSave() {
    setSaveState({ status: "saving" });
    const result = await saveClientKpiConfig(selectedClientId, selectedKeys);
    if (result.ok) {
      setSelectedKeys(result.savedKeys);
      setSavedKeys(result.savedKeys);
      setSaveState({ status: "success" });
    } else {
      setSaveState({ status: "error", message: result.error });
    }
  }

  const dirty = !arraysEqual(savedKeys, selectedKeys);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <label
          htmlFor="client-select"
          className="text-sm font-medium text-muted-foreground"
        >
          {t.kpiConfigClient}
        </label>
        <select
          id="client-select"
          value={selectedClientId}
          onChange={(e) => handleClientChange(e.target.value)}
          className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_GROUPS.map((group) => {
          const groupKpis = KPI_CATALOG.filter(
            (def) => def.group === group.key
          );
          return (
            <fieldset
              key={group.key}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <legend className="px-2 text-sm font-semibold">
                {KPI_GROUP_LABELS_EN[group.key]}
              </legend>
              {groupKpis.map((definition) => (
                <label
                  key={definition.key}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(definition.key)}
                    onChange={() => toggleKpi(definition.key)}
                    className="mt-0.5 size-4 rounded border-border accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {getAdminKpiTitle(definition.key)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {definition.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saveState.status === "saving" || !dirty}>
          {saveState.status === "saving" ? t.kpiConfigSaving : t.kpiConfigSave}
        </Button>
        {saveState.status === "success" && (
          <p className="text-sm text-emerald-600">{t.kpiConfigSaved}</p>
        )}
        {saveState.status === "error" && (
          <p className="text-sm text-destructive">{saveState.message}</p>
        )}
      </div>
    </div>
  );
}

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
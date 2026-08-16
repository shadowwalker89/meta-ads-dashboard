"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Package } from "@repo/shared";
import { PackageAssignmentPanel } from "@/components/admin/package-assignment-panel";
import { assignPackage } from "@/app/(dashboard)/admin/packages/actions";
import { formatRuleEffectiveDate } from "@/lib/pricing-format";
import type { ClientAssignmentEntry } from "@/lib/package-admin";

/**
 * Client container for the Super Admin package assignment page. The
 * mutation goes exclusively through the assignPackage server action,
 * which delegates to PackageAssignmentService — never through raw
 * repositories here.
 */
export function PackageAssignmentWorkflow({
  clients,
  packages,
}: {
  clients: ClientAssignmentEntry[];
  packages: Package[];
}) {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id ?? ""
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    if (!selectedClientId || !selectedPackageId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    const result = await assignPackage(selectedClientId, selectedPackageId);

    if (result.ok) {
      const value = result.value;
      const assignedAt = formatRuleEffectiveDate(value.packageAssignedAt);
      setSuccess(
        value.changed
          ? `پکیج با موفقیت تغییر کرد. زمان انتساب: ${assignedAt} — قوانین قیمت‌گذاری ایجادشده: ${value.pricingRulesCreated}`
          : `پکیج تغییری نکرد (همان پکیج فعلی بود). قوانین قیمت‌گذاری ایجادشده: ${value.pricingRulesCreated}`
      );
      setSelectedPackageId(null);
      router.refresh();
    } else {
      setError(result.error);
    }

    setBusy(false);
  }

  return (
    <PackageAssignmentPanel
      clients={clients}
      packages={packages}
      selectedClientId={selectedClientId}
      selectedPackageId={selectedPackageId}
      busy={busy}
      success={success}
      error={error}
      onClientChange={(clientId) => {
        setSelectedClientId(clientId);
        setSelectedPackageId(null);
        setSuccess(null);
        setError(null);
      }}
      onPackageChange={(packageId) => {
        setSelectedPackageId(packageId || null);
        setSuccess(null);
        setError(null);
      }}
      onAssign={handleAssign}
    />
  );
}
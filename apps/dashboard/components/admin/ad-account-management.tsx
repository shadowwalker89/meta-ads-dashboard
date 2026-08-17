"use client";

import { useState } from "react";
import type { AdAccountAdminData } from "@/lib/client-admin";
import { AdAccountList } from "@/components/admin/ad-account-list";
import { AdAccountForm } from "@/components/admin/ad-account-form";

/**
 * Client container for the AdAccount management page: renders the list of
 * a client's ad accounts plus a create form. The package limit is
 * surfaced so the UI explains enforcement, but the real check happens in
 * the server action (SqlitePackageEnforcement).
 */
export function AdAccountManagement({
  data,
}: {
  data: AdAccountAdminData;
}) {
  const [creating, setCreating] = useState(false);
  const max = data.package?.maxAdAccounts ?? null;
  const limitReached =
    max !== null && typeof max === "number" && data.adAccounts.length >= max;

  return (
    <div className="flex flex-col gap-6">
      <AdAccountList
        adAccounts={data.adAccounts}
        packageName={data.package?.name ?? null}
        maxAdAccounts={max}
        limitReached={limitReached}
        onCreate={() => setCreating(true)}
      />

      {creating && (
        <AdAccountForm
          clientId={data.client.id}
          limitReached={limitReached}
          onCancel={() => setCreating(false)}
          onDone={() => setCreating(false)}
        />
      )}
    </div>
  );
}
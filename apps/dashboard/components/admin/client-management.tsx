"use client";

import { useState } from "react";
import type { Package } from "@repo/shared";
import type { ClientAdminEntry } from "@/lib/client-admin";
import { ClientList } from "@/components/admin/client-list";
import { ClientForm } from "@/components/admin/client-form";

/**
 * Client container for the Super Admin client management page: renders the
 * client list plus a create form. Data is loaded server-side and passed
 * in; mutations go through the server actions (createClient), never
 * through raw repositories.
 */
export function ClientManagement({
  clients,
  packages,
  canCreate,
}: {
  clients: ClientAdminEntry[];
  packages: Package[];
  canCreate: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <ClientList
        clients={clients}
        canCreate={canCreate}
        onCreate={() => setCreating(true)}
      />

      {creating && (
        <ClientForm
          packages={packages}
          onCancel={() => setCreating(false)}
          onDone={() => setCreating(false)}
        />
      )}
    </div>
  );
}
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingClient = editingId ? clients.find((c) => c.id === editingId) : null;

  return (
    <div className="flex flex-col gap-6">
      <ClientList
        clients={clients}
        canCreate={canCreate}
        onCreate={() => { setEditingId(null); setCreating(true); }}
        onEdit={(id) => { setCreating(false); setEditingId(id); }}
      />

      {creating && (
        <ClientForm
          mode="create"
          packages={packages}
          onCancel={() => setCreating(false)}
          onDone={() => setCreating(false)}
        />
      )}

      {editingClient && (
        <ClientForm
          mode="edit"
          clientId={editingClient.id}
          initialName={editingClient.name}
          initialBusinessType={editingClient.businessType}
          initialContactEmail={editingClient.contactEmail}
          initialPackageId={editingClient.packageId}
          initialIsActive={editingClient.isActive}
          packages={packages}
          onCancel={() => setEditingId(null)}
          onDone={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import type { Package } from "@repo/shared";
import { PackageList } from "@/components/admin/package-list";
import { PackageForm } from "@/components/admin/package-form";
import { toPackageSettingsInput } from "@/lib/package-settings-input";

/**
 * Client container for the Super Admin package management page: renders
 * the package list plus a create/edit form. Data is loaded server-side
 * and passed in; mutations go through the server actions (createPackage
 * / updatePackage), never through raw repositories.
 */
export function PackageManagement({ packages }: { packages: Package[] }) {
  const [editing, setEditing] = useState<{ pkg: Package } | "new" | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PackageList
        packages={packages}
        onCreate={() => setEditing("new")}
        onEdit={(pkg) => setEditing({ pkg })}
      />

      {editing === "new" && (
        <PackageForm
          mode="create"
          onCancel={() => setEditing(null)}
          onDone={() => setEditing(null)}
        />
      )}

      {editing !== null && editing !== "new" && (
        <PackageForm
          mode="edit"
          packageId={editing.pkg.id}
          initial={toPackageSettingsInput(editing.pkg)}
          onCancel={() => setEditing(null)}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}
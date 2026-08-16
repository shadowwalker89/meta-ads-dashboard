import type { Package } from "@repo/shared";
import { Button } from "@/components/ui/button";
import { PackageSettingsPreview } from "@/components/admin/package-settings-preview";

/**
 * Presentational. Renders every package as a card with its settings and
 * an edit action. Create/edit orchestration lives in the container
 * (PackageManagement); this component only renders and signals.
 */
export function PackageList({
  packages,
  onCreate,
  onEdit,
}: {
  packages: Package[];
  onCreate: () => void;
  onEdit: (pkg: Package) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={onCreate}>پکیج جدید</Button>
      </div>

      {packages.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          هنوز هیچ پکیجی تعریف نشده است.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <PackageSettingsPreview pkg={pkg} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(pkg)}
                  className="shrink-0"
                >
                  ویرایش
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
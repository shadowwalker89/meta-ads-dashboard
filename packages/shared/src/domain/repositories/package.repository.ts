import type { Package } from "../entities";

export interface PackageRepository {
  findById(id: string): Promise<Package | null>;
  findByCode(code: string): Promise<Package | null>;
  listAll(): Promise<Package[]>;
  create(pkg: Omit<Package, "id" | "createdAt">): Promise<Package>;
  update(
    id: string,
    changes: Partial<Omit<Package, "id" | "createdAt">>
  ): Promise<Package>;
}

import type { Client } from "../entities";
import type { PageRequest, PageResult } from "./shared";

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  findByIds(ids: string[]): Promise<Client[]>;
  list(page: PageRequest): Promise<PageResult<Client>>;
  /**
   * Creates a client already assigned to packageId. packageAssignedAt is
   * stamped by the storage implementation at creation time — callers do
   * not provide it.
   */
  create(
    client: Omit<Client, "id" | "createdAt" | "packageAssignedAt">
  ): Promise<Client>;
  /**
   * Updates a client. When packageId changes (reassignment),
   * packageAssignedAt is refreshed — to now, or to an explicitly
   * provided packageAssignedAt. Non-package updates preserve it.
   */
  update(
    id: string,
    changes: Partial<Omit<Client, "id" | "createdAt">>
  ): Promise<Client>;
  deactivate(id: string): Promise<void>;
}

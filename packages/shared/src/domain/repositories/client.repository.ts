import type { Client } from "../entities";
import type { PageRequest, PageResult } from "./shared";

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  findByIds(ids: string[]): Promise<Client[]>;
  list(page: PageRequest): Promise<PageResult<Client>>;
  create(client: Omit<Client, "id" | "createdAt">): Promise<Client>;
  update(
    id: string,
    changes: Partial<Omit<Client, "id" | "createdAt">>
  ): Promise<Client>;
  deactivate(id: string): Promise<void>;
}

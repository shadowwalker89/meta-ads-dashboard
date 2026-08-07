import type { AuditLog } from "../entities";
import type { PageRequest, PageResult } from "./shared";

export interface AuditLogRepository {
  append(entry: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  findByTarget(
    targetEntityType: string,
    targetEntityId: string,
    page: PageRequest
  ): Promise<PageResult<AuditLog>>;
  findByActor(
    actorUserId: string,
    page: PageRequest
  ): Promise<PageResult<AuditLog>>;
}

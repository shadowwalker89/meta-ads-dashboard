import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "../client-pg.js";
import type { AdminAssignment, AdminAssignmentRepository } from "@repo/shared";
import { timestampColumn } from "./pg-row-convert.js";

interface AdminAssignmentRow {
  id: string;
  admin_user_id: string;
  client_id: string;
  assigned_at: unknown;
}

function toDomain(row: AdminAssignmentRow): AdminAssignment {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    clientId: row.client_id,
    assignedAt: timestampColumn(row.assigned_at, "assigned_at"),
  };
}

export class PgAdminAssignmentRepository implements AdminAssignmentRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async findByAdmin(adminUserId: string): Promise<AdminAssignment[]> {
    const rows = await this.db.query<AdminAssignmentRow>(
      "SELECT * FROM admin_assignments WHERE admin_user_id = $1",
      [adminUserId]
    );
    return rows.map(toDomain);
  }

  async findByClient(clientId: string): Promise<AdminAssignment[]> {
    const rows = await this.db.query<AdminAssignmentRow>(
      "SELECT * FROM admin_assignments WHERE client_id = $1",
      [clientId]
    );
    return rows.map(toDomain);
  }

  async assign(
    adminUserId: string,
    clientId: string
  ): Promise<AdminAssignment> {
    const id = randomUUID();
    const assignedAt = new Date();
    // The UNIQUE (admin_user_id, client_id) violation surfaces as the
    // driver's raw error (code 23505) — deliberately NOT swallowed,
    // matching the SQLite repository's behavior.
    await this.db.execute(
      `INSERT INTO admin_assignments (id, admin_user_id, client_id, assigned_at)
       VALUES ($1, $2, $3, $4)`,
      [id, adminUserId, clientId, assignedAt]
    );
    return { id, adminUserId, clientId, assignedAt };
  }

  async unassign(adminUserId: string, clientId: string): Promise<void> {
    await this.db.execute(
      "DELETE FROM admin_assignments WHERE admin_user_id = $1 AND client_id = $2",
      [adminUserId, clientId]
    );
  }
}

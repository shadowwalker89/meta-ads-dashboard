import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { AdminAssignment, AdminAssignmentRepository } from "@repo/shared";

interface AdminAssignmentRow {
  id: string;
  admin_user_id: string;
  client_id: string;
  assigned_at: string;
}

function toDomain(row: AdminAssignmentRow): AdminAssignment {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    clientId: row.client_id,
    assignedAt: new Date(row.assigned_at),
  };
}

export class SqliteAdminAssignmentRepository implements AdminAssignmentRepository {
  constructor(private readonly db: Database) {}

  async findByAdmin(adminUserId: string): Promise<AdminAssignment[]> {
    const rows = this.db
      .prepare("SELECT * FROM admin_assignments WHERE admin_user_id = ?")
      .all(adminUserId) as AdminAssignmentRow[];
    return rows.map(toDomain);
  }

  async findByClient(clientId: string): Promise<AdminAssignment[]> {
    const rows = this.db
      .prepare("SELECT * FROM admin_assignments WHERE client_id = ?")
      .all(clientId) as AdminAssignmentRow[];
    return rows.map(toDomain);
  }

  async assign(adminUserId: string, clientId: string): Promise<AdminAssignment> {
    const id = randomUUID();
    const assignedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO admin_assignments (id, admin_user_id, client_id, assigned_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, adminUserId, clientId, assignedAt);
    return { id, adminUserId, clientId, assignedAt: new Date(assignedAt) };
  }

  async unassign(adminUserId: string, clientId: string): Promise<void> {
    this.db
      .prepare("DELETE FROM admin_assignments WHERE admin_user_id = ? AND client_id = ?")
      .run(adminUserId, clientId);
  }
}

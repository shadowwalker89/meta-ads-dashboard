import type { User } from "@repo/shared";
import { accessibleClientIds, requireRole, requireUser } from "@/lib/access";
import { getRepositories } from "@/lib/db";

export interface UserAdminEntry {
  id: string;
  fullName: string;
  email: string;
  role: User["role"];
  clientId: string | null;
  clientName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface UserAdminData {
  users: UserAdminEntry[];
  clients: Array<{ id: string; name: string }>;
  canCreateAdmin: boolean;
  actorId: string;
}

export async function getUserAdminData(): Promise<UserAdminData> {
  const actor = await requireUser();
  requireRole(actor, "admin", "super_admin");
  const repositories = getRepositories();
  const accessibleIds = await accessibleClientIds(actor);
  const clientRows = await repositories.clientRepository.findByIds(accessibleIds);
  const clientNames = new Map(clientRows.map((client) => [client.id, client.name]));
  const users = (await repositories.userRepository.listAll()).filter((user) =>
    actor.role === "super_admin" ||
    (user.clientId !== null && clientNames.has(user.clientId))
  );

  return {
    users: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      clientName: user.clientId ? clientNames.get(user.clientId) ?? null : null,
      isActive: user.isActive ?? true,
      createdAt: user.createdAt,
    })),
    clients: clientRows.map((client) => ({ id: client.id, name: client.name })),
    canCreateAdmin: actor.role === "super_admin",
    actorId: actor.id,
  };
}

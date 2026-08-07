import type { User } from "../entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, "id" | "createdAt">): Promise<User>;
  update(
    id: string,
    changes: Partial<Omit<User, "id" | "createdAt">>
  ): Promise<User>;
}

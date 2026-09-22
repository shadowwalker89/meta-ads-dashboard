import type { User } from "../entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  listAll(): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  findByAuthId(authId: string): Promise<User | null>;
  setAuthId(id: string, authId: string | null): Promise<boolean>;
  create(user: Omit<User, "id" | "createdAt">): Promise<User>;
  update(
    id: string,
    changes: Partial<Omit<User, "id" | "createdAt">>
  ): Promise<User>;
}

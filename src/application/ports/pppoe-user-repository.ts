import type { PppoeUser } from "../../domain/pppoe-user.js";

export interface PppoeUserRepository {
  findById(id: string): Promise<PppoeUser | null>;

  create(
    user: PppoeUser,
  ): Promise<void>;

  save(
    user: PppoeUser,
  ): Promise<void>;
}
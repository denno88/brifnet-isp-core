import { Installation } from "../../domain/installation.js";
import type {
  AccountNumberAllocation,
} from "./account-number-allocator.js";

export interface InstallationRepository {
  create(
    installation: Installation,
    allocation: AccountNumberAllocation,
  ): Promise<void>;

  findById(id: string): Promise<Installation | null>;

  findByIdForUpdate(id: string): Promise<Installation | null>;

  findByAccountNumber(
    accountNumber: string,
  ): Promise<Installation | null>;

  save(installation: Installation): Promise<void>;
}
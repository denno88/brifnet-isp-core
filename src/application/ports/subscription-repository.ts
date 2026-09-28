import { Subscription } from "../../domain/subscription.js";

export interface SubscriptionRepository {
  create(subscription: Subscription): Promise<void>;

  findById(id: string): Promise<Subscription | null>;

  /*
   * Same lookup as findById(), but locks the subscription
   * row until the surrounding transaction commits or rolls back.
   *
   * Used when the caller is about to mutate subscription
   * entitlement and must prevent concurrent renewals from
   * reading the same current_period_end.
   */
  findByIdForUpdate(
    id: string,
  ): Promise<Subscription | null>;

  findActiveByInstallationId(
    installationId: string,
  ): Promise<Subscription | null>;

  findRenewableByInstallationId(
    installationId: string,
  ): Promise<Subscription | null>;

  findRenewableByInstallationIdForUpdate(
    installationId: string,
  ): Promise<Subscription | null>;

  save(subscription: Subscription): Promise<void>;
}

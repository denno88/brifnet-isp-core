import { describe, expect, it } from "vitest";
import { Subscription } from "../../domain/subscription.js";

describe("Subscription", ()=>{
  const periodStart = new Date("2026-09-01T00:00:00Z");
  const periodEnd = new Date("2026-09-08T00:00:00Z");

  function createSubscription(): Subscription{
    return new Subscription(
      "sub-001",
      "installation-001",
      "product-001",
      "ACTIVE",
      periodStart,
      periodEnd,
      new Date("2026-09-10T00:00:00Z"),
      new Date("2026-09-01T00:00:00Z"),
    );
  }

  it("starts as ACTIVE", ()=>{
    const subscription = createSubscription();
    expect(subscription.status).toBe("ACTIVE");
  });

  it("does not enter GRACE before the paid period ends", ()=>{
    const subscription = createSubscription();
    const now = new Date("2026-09-07T00:00:00Z");

    subscription.enterGrace(now, 2);

    expect(subscription.status).toBe("ACTIVE");
  });

  it("enters GRACE when the paid period has ended", () => {
    const subscription = createSubscription();

    const now = new Date("2026-09-08T00:00:00Z");

    subscription.enterGrace(now, 2);

    expect(subscription.status).toBe("GRACE");
  });

  it("expires immediately when there is no grace period", () => {
    const subscription = createSubscription();

    const now = new Date("2026-09-08T00:00:00Z");

    subscription.enterGrace(now, 0);

    expect(subscription.status).toBe("EXPIRED");
    expect(subscription.graceEndsAt).toBeNull();
  });

  it("does not expire during the grace period", () => {
    const subscription = createSubscription();

    const graceStart = new Date("2026-09-08T00:00:00Z");

    subscription.enterGrace(graceStart, 2);

    const now = new Date("2026-09-09T12:00:00Z");

    subscription.expire(now);

    expect(subscription.status).toBe("GRACE");
  });

  it("expires when the grace period ends", () => {
    const subscription = createSubscription();

    const graceStart = new Date("2026-09-08T00:00:00Z");

    subscription.enterGrace(graceStart, 2);

    const now = new Date("2026-09-10T00:00:00Z");

    subscription.expire(now);

    expect(subscription.status).toBe("EXPIRED");
  });

  it("renewal extends from the existing paid period end", () => {
    const subscription = createSubscription();

    subscription.renew(7, 2);

    expect(subscription.currentPeriodEnd).toEqual(
      new Date("2026-09-15T00:00:00Z"),
    );

    expect(subscription.status).toBe("ACTIVE");
  });

  it("renewal during GRACE extends from the original paid period end", () => {
    const subscription = createSubscription();

    const graceStart = new Date("2026-09-08T00:00:00Z");

    subscription.enterGrace(graceStart, 2);

    expect(subscription.status).toBe("GRACE");

    subscription.renew(7, 2);

    expect(subscription.status).toBe("ACTIVE");

    expect(subscription.currentPeriodEnd).toEqual(
      new Date("2026-09-15T00:00:00Z"),
    );

    expect(subscription.graceEndsAt).toEqual(
      new Date("2026-09-17T00:00:00Z"),
    );
  });

});
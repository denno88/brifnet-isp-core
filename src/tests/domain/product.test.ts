import { describe, expect, it } from "vitest";
import { Product } from "../../domain/product.js";

describe("Product", () => {
  it("creates a product with commercial terms", () => {
    const product = new Product(
      "product-20mbps-weekly",
      "20 Mbps Weekly",
      "plan-20mbps",
      349,
      7,
      2,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(product.id).toBe("product-20mbps-weekly");
    expect(product.name).toBe("20 Mbps Weekly");
    expect(product.servicePlanId).toBe("plan-20mbps");
    expect(product.price).toBe(349);
    expect(product.durationDays).toBe(7);
    expect(product.gracePeriodDays).toBe(2);
  });

  it("supports products without a grace period", () => {
    const product = new Product(
      "product-20mbps-daily",
      "20 Mbps Daily",
      "plan-20mbps",
      50,
      1,
      0,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(product.durationDays).toBe(1);
    expect(product.gracePeriodDays).toBe(0);
  });

  it("allows multiple products to use the same service plan", () => {
    const weekly = new Product(
      "product-weekly",
      "20 Mbps Weekly",
      "plan-20mbps",
      349,
      7,
      2,
      new Date("2026-09-01T00:00:00Z"),
    );

    const twoWeeks = new Product(
      "product-two-weeks",
      "20 Mbps 2 Weeks",
      "plan-20mbps",
      798,
      14,
      3,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(weekly.servicePlanId).toBe("plan-20mbps");
    expect(twoWeeks.servicePlanId).toBe("plan-20mbps");
  });
});
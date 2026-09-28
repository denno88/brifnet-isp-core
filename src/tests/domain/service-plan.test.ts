import { describe, expect, it } from "vitest";
import { ServicePlan } from "../../domain/service-plan.js";

describe("ServicePlan", () => {
  it("creates a service plan with download and upload speeds", () => {
    const plan = new ServicePlan(
      "plan-20mbps",
      "20 Mbps",
      20,
      20,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(plan.id).toBe("plan-20mbps");
    expect(plan.name).toBe("20 Mbps");
    expect(plan.downloadMbps).toBe(20);
    expect(plan.uploadMbps).toBe(20);
  });

  it("supports different download and upload speeds", () => {
    const plan = new ServicePlan(
      "plan-30mbps",
      "30 Mbps",
      30,
      10,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(plan.downloadMbps).toBe(30);
    expect(plan.uploadMbps).toBe(10);
  });
});
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import type { PoolClient } from "pg";
import pool from "../../config/database.js";

describe("ISP database schema", () => {
  let client: PoolClient;

  beforeAll(async () => {
    client = await pool.connect();

    await client.query("BEGIN");

    await client.query(`
      INSERT INTO pppoe_users (
        id,
        name,
        phone
      )
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Test Customer',
        '0712345678'
      )
    `);

    await client.query(`
      INSERT INTO service_plans (
        id,
        name,
        download_mbps,
        upload_mbps
      )
      VALUES (
        '22222222-2222-2222-2222-222222222222',
        '20 Mbps',
        20,
        20
      )
    `);

    await client.query(`
      INSERT INTO products (
        id,
        name,
        service_plan_id,
        price,
        duration_days,
        grace_period_days
      )
      VALUES (
        '33333333-3333-3333-3333-333333333333',
        '20 Mbps Weekly',
        '22222222-2222-2222-2222-222222222222',
        349,
        7,
        2
      )
    `);

    await client.query(`
      INSERT INTO pppoe_installations (
        id,
        pppoe_user_id,
        account_prefix,
        account_sequence,
        account_number
      )
      VALUES (
        '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        'BRF',
        100,
        'BRF100'
      )
    `);

    await client.query(`
      INSERT INTO subscriptions (
        id,
        installation_id,
        product_id,
        status,
        current_period_start,
        current_period_end
      )
      VALUES (
        '55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        'ACTIVE',
        '2026-09-01T00:00:00Z',
        '2026-09-08T00:00:00Z'
      )
    `);
  });

  afterAll(async () => {
    await client.query("ROLLBACK");

    client.release();

    await pool.end();
  });

  it("creates the core ISP records and relationships", async () => {
    const result = await client.query(`
      SELECT
        i.account_number,
        i.status,
        s.status AS subscription_status,
        p.name AS product_name,
        sp.name AS service_plan_name
      FROM pppoe_users u

      JOIN pppoe_installations i
        ON i.pppoe_user_id = u.id

      JOIN subscriptions s
        ON s.installation_id = i.id

      JOIN products p
        ON p.id = s.product_id

      JOIN service_plans sp
        ON sp.id = p.service_plan_id

      WHERE u.id = '11111111-1111-1111-1111-111111111111'
    `);

    expect(result.rows).toHaveLength(1);

    expect(result.rows[0]?.account_number).toBe(
      "BRF100",
    );

    expect(result.rows[0]?.status).toBe(
      "PENDING",
    );

    expect(result.rows[0]?.subscription_status).toBe(
      "ACTIVE",
    );

    expect(result.rows[0]?.product_name).toBe(
      "20 Mbps Weekly",
    );

    expect(result.rows[0]?.service_plan_name).toBe(
      "20 Mbps",
    );
  });

  it("prevents two active subscriptions for one installation", async () => {
    await expect(
      client.query(`
        INSERT INTO subscriptions (
          id,
          installation_id,
          product_id,
          status,
          current_period_start,
          current_period_end
        )
        VALUES (
          '66666666-6666-6666-6666-666666666666',
          '44444444-4444-4444-4444-444444444444',
          '33333333-3333-3333-3333-333333333333',
          'ACTIVE',
          '2026-09-08T00:00:00Z',
          '2026-09-15T00:00:00Z'
        )
      `),
    ).rejects.toMatchObject({
      code: "23505",
    });
  });
});

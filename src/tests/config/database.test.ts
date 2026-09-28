import { describe, expect, it } from "vitest";

import pool from "../../config/database.js";

describe("PostgreSQL Connection", ()=>{
    it("Connects to postgreSQL", async ()=>{
        const result = await pool.query("SELECT 1 AS value");

        expect(result.rows[0]?.value).toBe(1);
    });
});
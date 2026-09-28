import pool from "../config/database.js";
import fs from "node:fs/promises";
import path from "node:path";


async function migrate(): Promise<void> {
    const migrationsDirectory = path.resolve(
        process.cwd(),
        "src/database/migrations",
    );

    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    
    const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

    for (const file of files){
        const result = await pool.query(
            `
                SELECT 1
                FROM schema_migrations
                WHERE filename = $1
            `,
            [file],
        );

        if((result.rowCount ?? 0) > 0){
            console.log(`Skipping migration: ${file}`);
            continue;
        }
        
        const filePath = path.join(migrationsDirectory, file);
        const sql = await fs.readFile(filePath, "utf8");

        const client = await pool.connect();

        try {
            await client.query("BEGIN");
            console.log(`Running migration: ${file}`);

            await client.query(sql);

            await client.query(
                `
                    INSERT INTO schema_migrations (filename)
                    VALUES ($1)
                `,
                [file],
            );

            await client.query("COMMIT");

            console.log(`Completed migration: ${file}`);
        } catch(error){
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }        
    }

    await pool.end();}

migrate().catch(async (error: unknown) => {
    console.error("Migration failed:", error);
    await pool.end();
    process.exit(1);
})
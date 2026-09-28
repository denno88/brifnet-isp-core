import { Pool } from "pg";

const pool = new Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "Den4083*8879",
    database: process.env.DB_NAME ?? "brifnet_isp_core",
});

export default pool;
import { Pool } from "pg";
import dotenv from "dotenv";

// Load .env before reading DATABASE_URL
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || "";

export const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;


import bcrypt from "bcrypt";
import pg from "pg";

const { Client } = pg;

export async function createAdmin() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error("DATABASE_URL is not set");
  }
  const sslEnabled = String(process.env.DB_SSL || "true").toLowerCase() === "true";
  const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true";

  const client = new Client({
    connectionString: conn,
    ssl: sslEnabled ? { rejectUnauthorized } : undefined,
  });

  try {
    await client.connect();

    const email = "fysl71443@gmail.com";
    const password = "StrongPass123";
    const hashedPassword = await bcrypt.hash(password, 10);

    await client.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, $3)",
      [email, hashedPassword, "admin"]
    );
  } finally {
    await client.end();
  }
}

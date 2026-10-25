const crypto = require("node:crypto");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const databasePath = path.join(__dirname, "data", "part91.sqlite");
const username = (process.env.INITIAL_USERNAME || "VMC43").trim();
const email = (process.env.INITIAL_EMAIL || "VMC43@test.com").trim();
const password = process.env.INITIAL_PASSWORD;
const PASSWORD_MIN_LENGTH = 15;

if (!password) {
  console.error("Set INITIAL_PASSWORD to the initial account password before running setup-user.");
  process.exit(1);
}
if ([...password].length < PASSWORD_MIN_LENGTH || Buffer.byteLength(password) > 1024) {
  console.error(`INITIAL_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters and no more than 1024 bytes.`);
  process.exit(1);
}
if (username.length < 1 || username.length > 64 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Set a username of 1-64 characters and a valid email address.");
  process.exit(1);
}

const fs = require("node:fs");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  if (database.prepare("SELECT COUNT(*) AS count FROM users").get().count > 0) {
    throw new Error("An account already exists. Initial account setup will not overwrite it.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  database.prepare(`
    INSERT INTO users (username, email, password_salt, password_hash)
    VALUES (?, ?, ?, ?)
  `).run(username, email, salt, passwordHash);
  console.log(`Initial account ${username} (${email}) created. The password is stored as a salted hash.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  database.close();
}

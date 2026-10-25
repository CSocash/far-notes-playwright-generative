const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATABASE_PATH = path.join(DATA_DIR, "part91.sqlite");
const SUBSECTIONS_PATH = path.join(ROOT, "regulation-subsections.json");
const subsectionCatalog = JSON.parse(fs.readFileSync(SUBSECTIONS_PATH, "utf8"));
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const MAX_BODY_BYTES = 16_384;
const SUPPORTED_PARTS = new Set(["61", "91"]);
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MAX_AGE_MS = 30 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 15;
const scrypt = promisify(crypto.scrypt);
const authAttempts = new Map();

const starterRegulations = [
  ["91.1", "91.1 — Applicability"],
  ["91.3", "91.3 — Responsibility and authority of the pilot in command"],
  ["91.5", "91.5 — Pilot in command of aircraft requiring a type rating"],
  ["91.7", "91.7 — Civil aircraft airworthiness"],
  ["91.9", "91.9 — Civil aircraft flight manual, marking, and placard requirements"],
  ["91.11", "91.11 — Prohibition on interference with crewmembers"],
  ["91.13", "91.13 — Careless or reckless operation"],
  ["91.15", "91.15 — Dropping objects"],
  ["91.17", "91.17 — Alcohol or drugs"],
  ["91.21", "91.21 — Portable electronic devices"],
  ["91.103", "91.103 — Preflight action"],
  ["91.105", "91.105 — Flight crewmembers at stations"],
  ["91.107", "91.107 — Use of safety belts, shoulder harnesses, and child restraint systems"],
  ["91.111", "91.111 — Operating near other aircraft"],
  ["91.113", "91.113 — Right-of-way rules"],
  ["91.115", "91.115 — Right-of-way rules: water operations"],
  ["91.117", "91.117 — Aircraft speed"],
  ["91.119", "91.119 — Minimum safe altitudes"],
  ["91.121", "91.121 — Altimeter settings"],
  ["91.123", "91.123 — Compliance with ATC clearances and instructions"],
  ["91.125", "91.125 — ATC light signals"],
  ["91.126", "91.126 — Operating on or in the vicinity of an airport in Class G airspace"],
  ["91.127", "91.127 — Operating on or in the vicinity of an airport in Class E airspace"],
  ["91.129", "91.129 — Operations in Class D airspace"],
  ["91.130", "91.130 — Operations in Class C airspace"],
  ["91.131", "91.131 — Operations in Class B airspace"],
  ["91.133", "91.133 — Restricted and prohibited areas"],
  ["91.135", "91.135 — Operations in Class A airspace"],
  ["91.137", "91.137 — Temporary flight restrictions in the vicinity of disaster or hazard areas"],
  ["91.151", "91.151 — Fuel requirements for flight in VFR conditions"],
  ["91.153", "91.153 — VFR flight plan: information required"],
  ["91.155", "91.155 — Basic VFR weather minimums"],
  ["91.157", "91.157 — Special VFR weather minimums"],
  ["91.159", "91.159 — VFR cruising altitude or flight level"],
  ["91.167", "91.167 — Fuel requirements for flight in IFR conditions"],
  ["91.169", "91.169 — IFR flight plan: information required"],
  ["91.171", "91.171 — VOR equipment check for IFR operations"],
  ["91.173", "91.173 — ATC clearance and flight plan required"],
  ["91.175", "91.175 — Takeoff and landing under IFR"],
  ["91.177", "91.177 — Minimum altitudes for IFR operations"],
  ["91.179", "91.179 — IFR cruising altitude or flight level"],
  ["91.205", "91.205 — Powered civil aircraft with standard category U.S. airworthiness certificates: instrument and equipment requirements"],
  ["91.207", "91.207 — Emergency locator transmitters"],
  ["91.209", "91.209 — Aircraft lights"],
  ["91.211", "91.211 — Supplemental oxygen"],
  ["91.213", "91.213 — Inoperative instruments and equipment"],
  ["91.215", "91.215 — ATC transponder and altitude reporting equipment and use"],
  ["91.217", "91.217 — Data correspondence between automatically reported pressure altitude data and the pilot's altitude reference"],
  ["91.225", "91.225 — Automatic Dependent Surveillance-Broadcast (ADS-B) Out equipment and use"],
  ["91.303", "91.303 — Aerobatic flight"],
  ["91.307", "91.307 — Parachutes and parachuting"],
  ["91.309", "91.309 — Towing: gliders"],
  ["91.313", "91.313 — Restricted category civil aircraft: operating limitations"],
  ["91.319", "91.319 — Aircraft having experimental certificates: operating limitations"],
  ["91.403", "91.403 — General"],
  ["91.405", "91.405 — Maintenance required"],
  ["91.407", "91.407 — Operation after maintenance, preventive maintenance, rebuilding, or alteration"],
  ["91.409", "91.409 — Inspections"],
  ["91.411", "91.411 — Altimeter system and altitude reporting equipment tests and inspections"],
  ["91.413", "91.413 — ATC transponder tests and inspections"],
  ["91.417", "91.417 — Maintenance records"]
];

const part61StarterRegulations = [
  ["61.3", "61.3 — Requirement for certificates, ratings, and authorizations"],
  ["61.23", "61.23 — Medical certificates: Requirement and duration"],
  ["61.31", "61.31 — Type rating requirements, additional training, and authorization requirements"],
  ["61.35", "61.35 — Knowledge test: Prerequisites and passing grades"],
  ["61.39", "61.39 — Practical tests: Prerequisites and passing grades"],
  ["61.51", "61.51 — Pilot logbooks"],
  ["61.53", "61.53 — Prohibition on operations during medical deficiency"],
  ["61.56", "61.56 — Flight review"],
  ["61.57", "61.57 — Recent flight experience: Pilot in command"],
  ["61.65", "61.65 — Instrument rating requirements"],
  ["61.83", "61.83 — Eligibility requirements for student pilots"],
  ["61.87", "61.87 — Solo requirements for student pilots"],
  ["61.89", "61.89 — General limitations"],
  ["61.93", "61.93 — Solo cross-country flight requirements"],
  ["61.103", "61.103 — Eligibility requirements: Private pilot"],
  ["61.105", "61.105 — Aeronautical knowledge: Private pilot"],
  ["61.107", "61.107 — Flight proficiency: Private pilot"],
  ["61.109", "61.109 — Aeronautical experience: Private pilot"],
  ["61.123", "61.123 — Eligibility requirements: Commercial pilot"],
  ["61.125", "61.125 — Aeronautical knowledge: Commercial pilot"],
  ["61.127", "61.127 — Flight proficiency: Commercial pilot"],
  ["61.129", "61.129 — Aeronautical experience: Commercial pilot"],
  ["61.153", "61.153 — Eligibility requirements: Airline transport pilot"],
  ["61.155", "61.155 — Aeronautical knowledge: Airline transport pilot"],
  ["61.159", "61.159 — Aeronautical experience: Airline transport pilot"],
  ["61.183", "61.183 — Eligibility requirements: Flight instructor"],
  ["61.185", "61.185 — Aeronautical knowledge: Flight instructor"],
  ["61.187", "61.187 — Flight proficiency: Flight instructor"],
  ["61.189", "61.189 — Flight instructor records"],
  ["61.197", "61.197 — Recent experience requirements: Flight instructor"]
];

fs.mkdirSync(DATA_DIR, { recursive: true });
const database = new DatabaseSync(DATABASE_PATH);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS regulations (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    part TEXT NOT NULL DEFAULT '91',
    regulation TEXT NOT NULL DEFAULT '',
    is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
    covered INTEGER NOT NULL DEFAULT 0 CHECK (covered IN (0, 1)),
    date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS regulation_subsections (
    id INTEGER PRIMARY KEY,
    regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    code TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    covered INTEGER NOT NULL DEFAULT 0 CHECK (covered IN (0, 1)),
    date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (regulation_id, code)
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  PRAGMA foreign_keys = ON;
`);
database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
database.prepare("DELETE FROM password_resets WHERE expires_at <= ?").run(Date.now());

const regulationColumns = database.prepare("PRAGMA table_info(regulations)").all();
if (!regulationColumns.some((column) => column.name === "part")) {
  database.exec("ALTER TABLE regulations ADD COLUMN part TEXT NOT NULL DEFAULT '91'");
}
if (!regulationColumns.some((column) => column.name === "is_locked")) {
  database.exec("ALTER TABLE regulations ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1))");
}
if (!regulationColumns.some((column) => column.name === "user_id")) {
  database.exec("ALTER TABLE regulations ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
}

const legacyOwner = database.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get();
if (legacyOwner) {
  database.prepare("UPDATE regulations SET user_id = ? WHERE user_id IS NULL").run(legacyOwner.id);
}

function seedStarterRegulations(part, starterList, userId) {
  const count = database.prepare("SELECT COUNT(*) AS count FROM regulations WHERE part = ? AND user_id = ?").get(part, userId).count;
  if (count !== 0) return;
  const insert = database.prepare("INSERT INTO regulations (user_id, part, regulation, is_locked) VALUES (?, ?, ?, 1)");
  database.exec("BEGIN");
  try {
    for (const [, regulation] of starterList) insert.run(userId, part, regulation);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
const users = database.prepare("SELECT id FROM users ORDER BY id").all();
for (const user of users) {
  seedStarterRegulations("91", starterRegulations, user.id);
  seedStarterRegulations("61", part61StarterRegulations, user.id);
}

const starterSectionNumbers = new Map([
  ["91", new Set(starterRegulations.map(([section]) => section))],
  ["61", new Set(part61StarterRegulations.map(([section]) => section))]
]);
const existingRegulations = database.prepare("SELECT id, user_id, part, regulation FROM regulations ORDER BY id").all();
const starterCounts = new Map();
const lockRegulation = database.prepare("UPDATE regulations SET is_locked = 1 WHERE id = ?");
for (const regulation of existingRegulations) {
  const ownerPart = `${regulation.user_id}:${regulation.part}`;
  const partCounts = starterCounts.get(ownerPart) || 0;
  const number = regulation.regulation.match(/^\s*(\d+\.\d+)/)?.[1];
  const isStarterNumber = starterSectionNumbers.get(regulation.part)?.has(number);
  const isOriginalSeedRow = partCounts < starterSectionNumbers.get(regulation.part)?.size;
  if (isStarterNumber || isOriginalSeedRow) lockRegulation.run(regulation.id);
  starterCounts.set(ownerPart, partCounts + 1);
}

const allRegulations = database.prepare(`
  SELECT r.id, r.part, r.regulation, r.covered, r.date, r.notes
  FROM regulations r
`).all();
const createSubsection = database.prepare(`
  INSERT OR IGNORE INTO regulation_subsections (regulation_id, code, title, covered, date, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateSubsectionTitle = database.prepare(`
  UPDATE regulation_subsections
  SET title = ?, updated_at = CURRENT_TIMESTAMP
  WHERE regulation_id = ? AND code = ? AND title != ?
`);
for (const regulation of allRegulations) {
  const sectionNumber = regulation.regulation.match(/^\s*(\d+\.\d+)/)?.[1];
  const definitions = subsectionCatalog.parts[regulation.part]?.[sectionNumber] || [];
  const subsections = definitions.length > 0 ? definitions : [{ code: "", title: "Entire section" }];
  for (const subsection of subsections) {
    createSubsection.run(
      regulation.id,
      subsection.code,
      subsection.title,
      regulation.covered,
      regulation.date,
      regulation.notes
    );
    updateSubsectionTitle.run(subsection.title, regulation.id, subsection.code, subsection.title);
  }
}

const listRegulations = database.prepare(`
  SELECT id, regulation, is_locked
  FROM regulations
  WHERE part = ? AND user_id = ?
  ORDER BY id
`);
const getRegulation = database.prepare(`
  SELECT id, regulation, part, is_locked
  FROM regulations
  WHERE id = ? AND part = ? AND user_id = ?
`);
const createRegulation = database.prepare(`
  INSERT INTO regulations (user_id, part, regulation, covered, date, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const listSubsections = database.prepare(`
  SELECT id, code, title, covered, date, notes
  FROM regulation_subsections
  WHERE regulation_id = ?
  ORDER BY id
`);
const getSubsection = database.prepare(`
  SELECT s.id, s.regulation_id, s.code, s.title, s.covered, s.date, s.notes
  FROM regulation_subsections s
  JOIN regulations r ON r.id = s.regulation_id
  WHERE s.id = ? AND r.part = ? AND r.user_id = ?
`);
const createWholeSectionSubsection = database.prepare(`
  INSERT INTO regulation_subsections (regulation_id, code, title)
  VALUES (?, '', 'Entire section')
`);

function createStarterRegulationsForUser(userId) {
  database.prepare("UPDATE regulations SET user_id = ? WHERE user_id IS NULL").run(userId);
  for (const [part, starterList] of [
    ["61", part61StarterRegulations],
    ["91", starterRegulations]
  ]) {
    const count = database.prepare("SELECT COUNT(*) AS count FROM regulations WHERE part = ? AND user_id = ?")
      .get(part, userId).count;
    if (count !== 0) continue;
    const insertRegulation = database.prepare(`
      INSERT INTO regulations (user_id, part, regulation, is_locked)
      VALUES (?, ?, ?, 1)
    `);
    for (const [sectionNumber, title] of starterList) {
      const result = insertRegulation.run(userId, part, title);
      const regulationId = Number(result.lastInsertRowid);
      const definitions = subsectionCatalog.parts[part]?.[sectionNumber] || [];
      const subsections = definitions.length > 0 ? definitions : [{ code: "", title: "Entire section" }];
      for (const subsection of subsections) {
        createSubsection.run(regulationId, subsection.code, subsection.title, 0, "", "");
      }
    }
  }
}

function regulationWithSubsections(regulation) {
  return {
    id: regulation.id,
    regulation: regulation.regulation,
    isLocked: Boolean(regulation.is_locked),
    subsections: listSubsections.all(regulation.id).map((subsection) => ({
      ...subsection,
      covered: Boolean(subsection.covered)
    }))
  };
}

function requestedPart(url) {
  const part = url.searchParams.get("part") || "91";
  return SUPPORTED_PARTS.has(part) ? part : null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseCookies(request) {
  const cookies = new Map();
  for (const part of (request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return cookies;
}

function authenticatedUser(request) {
  const token = parseCookies(request).get("study_session");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = database.prepare(`
    SELECT users.id, users.username, users.email, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(sha256(token));
  if (!session) return null;
  if (session.expires_at <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    return null;
  }
  return session;
}

function setSessionCookie(response, token) {
  response.setHeader("Set-Cookie", `study_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_MS / 1000}`);
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "study_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  return !origin || origin === `http://${request.headers.host}`;
}

function consumeRateLimit(request, key, limit = 8) {
  const now = Date.now();
  const ip = request.socket.remoteAddress || "unknown";
  const mapKey = `${key}:${ip}`;
  const attempt = authAttempts.get(mapKey);
  if (!attempt || attempt.resetAt <= now) {
    authAttempts.set(mapKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  attempt.count += 1;
  return attempt.count <= limit;
}

function revokeUserSessions(userId) {
  database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

async function handleAuthRequest(request, response, url) {
  const pathname = url.pathname;
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = authenticatedUser(request);
    if (!user) {
      json(response, 200, { authenticated: false });
      return true;
    }
    json(response, 200, { authenticated: true, username: user.username, email: user.email });
    return true;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return true;
    }
    if (!consumeRateLimit(request, "login")) {
      json(response, 429, { error: "Too many sign-in attempts. Please wait 15 minutes and try again." });
      return true;
    }
    try {
      const body = await readJson(request);
      const identifier = typeof body.username === "string" ? body.username.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const user = database.prepare(`
        SELECT id, username, email, password_salt, password_hash
        FROM users WHERE username = ? OR email = ?
      `).get(identifier, identifier);
      const suppliedHash = user
        ? await scrypt(password, user.password_salt, 64)
        : await scrypt(password, "invalid-account-salt", 64);
      const storedHash = user ? Buffer.from(user.password_hash, "hex") : Buffer.alloc(64);
      if (!user || suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(suppliedHash, storedHash)) {
        json(response, 401, { error: "Username or password is incorrect." });
        return true;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const now = Date.now();
      database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
      database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
        sha256(token), user.id, now + SESSION_MAX_AGE_MS
      );
      setSessionCookie(response, token);
      json(response, 200, { username: user.username });
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return true;
  }

  if (pathname === "/api/auth/register" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return true;
    }
    if (!consumeRateLimit(request, "register", 5)) {
      json(response, 429, { error: "Too many account creation attempts. Please wait 15 minutes and try again." });
      return true;
    }
    try {
      const body = await readJson(request);
      const username = typeof body.username === "string" ? body.username.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) {
        json(response, 400, { error: "Username must be 1-64 characters and use only letters, numbers, periods, underscores, or hyphens." });
        return true;
      }
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        json(response, 400, { error: "Enter a valid email address." });
        return true;
      }
      if ([...password].length < PASSWORD_MIN_LENGTH) {
        json(response, 400, { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
        return true;
      }
      if (Buffer.byteLength(password) > 1024) {
        json(response, 400, { error: "Password must be 1024 bytes or fewer." });
        return true;
      }
      const existing = database.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email);
      if (existing) {
        json(response, 409, { error: "That username or email is already in use." });
        return true;
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
      database.exec("BEGIN");
      try {
        const result = database.prepare(`
          INSERT INTO users (username, email, password_salt, password_hash)
          VALUES (?, ?, ?, ?)
        `).run(username, email, salt, passwordHash);
        createStarterRegulationsForUser(Number(result.lastInsertRowid));
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      json(response, 201, { accountCreated: true });
    } catch (error) {
      console.error("Unable to create an account.", error);
      json(response, error.statusCode || 400, { error: error.message });
    }
    return true;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return true;
    }
    const token = parseCookies(request).get("study_session");
    if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    clearSessionCookie(response);
    json(response, 200, { loggedOut: true });
    return true;
  }

  if (pathname === "/api/auth/forgot-password" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return true;
    }
    if (!consumeRateLimit(request, "reset")) {
      json(response, 429, { error: "Too many reset requests. Please wait 15 minutes and try again." });
      return true;
    }
    try {
      const body = await readJson(request);
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const user = database.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = Date.now() + RESET_MAX_AGE_MS;
        database.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
        database.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
          sha256(token), user.id, expiresAt
        );
        console.log(`Password reset link for ${user.email} (expires in 30 minutes):`);
        console.log(`http://127.0.0.1:${PORT}/reset-password#token=${token}`);
      }
      json(response, 200, { message: "If an account matches that address, a reset link is available in the local server terminal." });
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return true;
  }

  if (pathname === "/api/auth/reset-password" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return true;
    }
    try {
      const body = await readJson(request);
      const token = typeof body.token === "string" ? body.token : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[a-f0-9]{64}$/.test(token)) {
        json(response, 400, { error: "This reset link is invalid or has expired. Request a new one." });
        return true;
      }
      if ([...password].length < PASSWORD_MIN_LENGTH) {
        json(response, 400, { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
        return true;
      }
      if (Buffer.byteLength(password) > 1024) {
        json(response, 400, { error: "Password must be 1024 bytes or fewer." });
        return true;
      }
      const reset = database.prepare(`
        SELECT user_id FROM password_resets
        WHERE token_hash = ? AND expires_at > ?
      `).get(sha256(token), Date.now());
      if (!reset) {
        json(response, 400, { error: "This reset link is invalid or has expired. Request a new one." });
        return true;
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
      database.prepare("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?").run(
        salt, passwordHash, reset.user_id
      );
      database.prepare("DELETE FROM password_resets WHERE user_id = ?").run(reset.user_id);
      revokeUserSessions(reset.user_id);
      json(response, 200, { passwordUpdated: true });
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return true;
  }
  return false;
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function isIsoDate(value) {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function serveStatic(request, response, pathname) {
  const files = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/index.html": ["index.html", "text/html; charset=utf-8"],
    "/login": ["login.html", "text/html; charset=utf-8"],
    "/login.html": ["login.html", "text/html; charset=utf-8"],
    "/create-account": ["create-account.html", "text/html; charset=utf-8"],
    "/create-account.html": ["create-account.html", "text/html; charset=utf-8"],
    "/forgot-password": ["forgot-password.html", "text/html; charset=utf-8"],
    "/forgot-password.html": ["forgot-password.html", "text/html; charset=utf-8"],
    "/reset-password": ["reset-password.html", "text/html; charset=utf-8"],
    "/reset-password.html": ["reset-password.html", "text/html; charset=utf-8"],
    "/styles.css": ["styles.css", "text/css; charset=utf-8"],
    "/aircraft-front-view.png": ["aircraft-front-view.png", "image/png"],
    "/app.js": ["app.js", "text/javascript; charset=utf-8"],
    "/login.js": ["login.js", "text/javascript; charset=utf-8"],
    "/create-account.js": ["create-account.js", "text/javascript; charset=utf-8"],
    "/forgot-password.js": ["forgot-password.js", "text/javascript; charset=utf-8"],
    "/reset-password.js": ["reset-password.js", "text/javascript; charset=utf-8"]
  };
  const file = files[pathname];
  if (!file) {
    json(response, 404, { error: "Not found." });
    return;
  }
  response.writeHead(200, {
    "Content-Type": file[1],
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(path.join(ROOT, file[0])).pipe(response);
}

async function handleRequest(request, response) {
  let url;
  try {
    url = new URL(request.url, "http://localhost");
  } catch {
    json(response, 400, { error: "Invalid request URL." });
    return;
  }
  const pathname = url.pathname;

  if (await handleAuthRequest(request, response, url)) return;

  const publicPaths = new Set([
    "/login", "/login.html", "/create-account", "/create-account.html", "/forgot-password", "/forgot-password.html",
    "/reset-password", "/reset-password.html", "/styles.css", "/aircraft-front-view.png",
    "/login.js", "/create-account.js", "/forgot-password.js", "/reset-password.js"
  ]);
  const user = authenticatedUser(request);
  if (pathname.startsWith("/api/") && !user) {
    json(response, 401, { error: "Sign in required." });
    return;
  }
  if ((pathname === "/" || pathname === "/index.html" || pathname === "/app.js") && !user) {
    response.writeHead(302, { Location: "/login", "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if ((pathname === "/login" || pathname === "/login.html" || pathname === "/create-account" || pathname === "/create-account.html") && user) {
    response.writeHead(302, { Location: "/", "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (pathname === "/api/regulations" && request.method === "GET") {
    const part = requestedPart(url);
    if (!part) {
      json(response, 400, { error: "Part must be 61 or 91." });
      return;
    }
    json(response, 200, listRegulations.all(part, user.id).map(regulationWithSubsections));
    return;
  }

  if (pathname === "/api/regulations" && request.method === "POST") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return;
    }
    try {
      const part = requestedPart(url);
      if (!part) {
        json(response, 400, { error: "Part must be 61 or 91." });
        return;
      }
      const body = await readJson(request);
      const regulation = body.regulation ?? "";
      if (typeof regulation !== "string") {
        json(response, 400, { error: "Regulation must be text." });
        return;
      }
      const result = createRegulation.run(user.id, part, regulation, 0, "", "");
      const regulationId = Number(result.lastInsertRowid);
      createWholeSectionSubsection.run(regulationId);
      json(response, 201, regulationWithSubsections(getRegulation.get(regulationId, part, user.id)));
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  const match = pathname.match(/^\/api\/regulations\/(\d+)$/);
  if (match && request.method === "PATCH") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return;
    }
    const part = requestedPart(url);
    if (!part) {
      json(response, 400, { error: "Part must be 61 or 91." });
      return;
    }
    const id = Number(match[1]);
    try {
      const existing = getRegulation.get(id, part, user.id);
      if (!existing) {
        json(response, 404, { error: "Regulation not found." });
        return;
      }
      if (existing.is_locked) {
        json(response, 403, { error: "This regulation heading is protected and cannot be edited." });
        return;
      }
      const body = await readJson(request);
      if (typeof body.regulation !== "string") {
        json(response, 400, { error: "Regulation must be text." });
        return;
      }
      const result = database.prepare(`
        UPDATE regulations
        SET regulation = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND part = ? AND user_id = ?
      `).run(body.regulation, id, part, user.id);
      if (result.changes === 0) {
        json(response, 404, { error: "Regulation not found." });
        return;
      }
      json(response, 200, regulationWithSubsections(getRegulation.get(id, part, user.id)));
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  const subsectionMatch = pathname.match(/^\/api\/subsections\/(\d+)$/);
  if (subsectionMatch && request.method === "PATCH") {
    if (!isSameOrigin(request)) {
      json(response, 403, { error: "Request origin is not allowed." });
      return;
    }
    const part = requestedPart(url);
    if (!part) {
      json(response, 400, { error: "Part must be 61 or 91." });
      return;
    }
    try {
      const body = await readJson(request);
      const subsection = getSubsection.get(Number(subsectionMatch[1]), part, user.id);
      if (!subsection) {
        json(response, 404, { error: "Subsection not found." });
        return;
      }
      const updates = [];
      const values = [];
      if (Object.hasOwn(body, "covered")) {
        if (typeof body.covered !== "boolean") {
          json(response, 400, { error: "Covered must be true or false." });
          return;
        }
        updates.push("covered = ?");
        values.push(body.covered ? 1 : 0);
      }
      if (Object.hasOwn(body, "date")) {
        if (!isIsoDate(body.date)) {
          json(response, 400, { error: "Date must be a valid YYYY-MM-DD date." });
          return;
        }
        updates.push("date = ?");
        values.push(body.date);
      }
      if (Object.hasOwn(body, "notes")) {
        if (typeof body.notes !== "string") {
          json(response, 400, { error: "Notes must be text." });
          return;
        }
        updates.push("notes = ?");
        values.push(body.notes);
      }
      if (updates.length === 0) {
        json(response, 400, { error: "Provide at least one field to update." });
        return;
      }
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(subsection.id);
      database.prepare(`UPDATE regulation_subsections SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      const saved = database.prepare(`
        SELECT id, code, title, covered, date, notes
        FROM regulation_subsections WHERE id = ?
      `).get(subsection.id);
      json(response, 200, { ...saved, covered: Boolean(saved.covered) });
    } catch (error) {
      json(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  if (pathname.startsWith("/api/")) {
    json(response, 404, { error: "API endpoint not found." });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    json(response, 405, { error: "Method not allowed." });
    return;
  }
  if (!publicPaths.has(pathname) && pathname !== "/" && pathname !== "/index.html" && pathname !== "/app.js") {
    json(response, 404, { error: "Not found." });
    return;
  }
  serveStatic(request, response, pathname);
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed.", error);
    if (!response.headersSent) json(response, 500, { error: "An unexpected server error occurred." });
    else response.destroy(error);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FAA Regulations Study Log is running at http://127.0.0.1:${PORT}`);
  console.log(`SQLite database: ${DATABASE_PATH}`);
});

function closeServer() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);

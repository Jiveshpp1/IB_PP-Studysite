require("dotenv").config({ quiet: true });

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { Resend } = require("resend");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || "study_space",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const secureCookie = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const protectedPaths = new Set(["/server.js", "/package.json", "/package-lock.json", "/.env.example", "/database/schema.sql"]);
  if (protectedPaths.has(req.path)) return res.sendStatus(404);
  next();
});
app.use(express.static(path.join(__dirname)));

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const randomCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
const signCode = code => crypto.createHmac("sha256", sessionSecret).update(code).digest("hex");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookie,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setSessionCookie(res, token) {
  res.cookie("study_session", token, cookieOptions);
}

async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.execute(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))",
    [userId, hash(token)]
  );
  setSessionCookie(res, token);
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.study_session;
    if (!token) return res.status(401).json({ error: "Please sign in to continue." });
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.is_verified = 1`,
      [hash(token)]
    );
    if (!rows.length) return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

app.use((req, res, next) => {
  const cookie = req.headers.cookie || "";
  req.cookies = Object.fromEntries(cookie.split(";").map(part => {
    const separator = part.indexOf("=");
    return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter(([key]) => key));
  next();
});

async function sendVerificationCode(email, code, subject = "Verify your Study Space account") {
  if (!resend || !process.env.RESEND_FROM_EMAIL) return false;
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject,
    text: `Your Study Space verification code is ${code}. It expires in 15 minutes.`,
  });
  if (error) throw new Error("Email delivery failed. Check the Resend sender configuration and try again.");
  return true;
}

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

app.post("/api/auth/signup", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 1 || name.length > 100 || !emailPattern.test(email) || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Enter a name, valid email, and password between 8 and 128 characters." });
  }
  const [existing] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length) return res.status(409).json({ error: "An account with that email already exists." });

  const code = randomCode();
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, verification_code_hash, verification_expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`,
    [name, email, passwordHash, signCode(code)]
  );
  if (!resend || !process.env.RESEND_FROM_EMAIL) {
    await pool.execute("DELETE FROM users WHERE id = ?", [result.insertId]);
    return res.status(503).json({ error: "Email verification is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL, then try again." });
  }
  try {
    await sendVerificationCode(email, code);
  } catch (error) {
    await pool.execute("DELETE FROM users WHERE id = ?", [result.insertId]);
    throw error;
  }
  res.status(201).json({ message: "We sent a verification code to your email.", needsVerification: true, email });
});

app.post("/api/auth/verify", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter your email and the 6-digit code." });
  const [rows] = await pool.execute(
    "SELECT id, name, email, verification_code_hash FROM users WHERE email = ? AND is_verified = 0 AND verification_expires_at > UTC_TIMESTAMP()",
    [email]
  );
  if (!rows.length || !rows[0].verification_code_hash || !crypto.timingSafeEqual(Buffer.from(signCode(code)), Buffer.from(rows[0].verification_code_hash))) {
    return res.status(400).json({ error: "That code is invalid or has expired. Request a new one." });
  }
  await pool.execute("UPDATE users SET is_verified = 1, verification_code_hash = NULL, verification_expires_at = NULL WHERE id = ?", [rows[0].id]);
  await createSession(rows[0].id, res);
  res.json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email } });
});

app.post("/api/auth/resend-verification", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  const [rows] = await pool.execute("SELECT id FROM users WHERE email = ? AND is_verified = 0", [email]);
  if (!rows.length) return res.json({ message: "If the account needs verification, a new code will be sent." });
  const code = randomCode();
  await pool.execute(
    "UPDATE users SET verification_code_hash = ?, verification_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) WHERE id = ?",
    [signCode(code), rows[0].id]
  );
  if (!resend || !process.env.RESEND_FROM_EMAIL) return res.status(503).json({ error: "Email verification is not configured on this server." });
  await sendVerificationCode(email, code);
  res.json({ message: "A new code has been sent." });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!emailPattern.test(email) || !password) return res.status(400).json({ error: "Enter a valid email and password." });
  const [rows] = await pool.execute("SELECT id, name, email, password_hash, is_verified FROM users WHERE email = ?", [email]);
  if (!rows.length || !rows[0].password_hash || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  if (!rows[0].is_verified) return res.status(403).json({ error: "Please verify your email before signing in.", needsVerification: true, email });
  await createSession(rows[0].id, res);
  res.json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email } });
});

app.get("/api/auth/session", async (req, res) => {
  const token = req.cookies?.study_session;
  if (!token) return res.json({ user: null });
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.is_verified = 1`,
    [hash(token)]
  );
  res.json({ user: rows[0] || null });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = req.cookies?.study_session;
  if (token) await pool.execute("DELETE FROM sessions WHERE token_hash = ?", [hash(token)]);
  res.clearCookie("study_session", { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  const [rows] = await pool.execute("SELECT id FROM users WHERE email = ? AND is_verified = 1", [email]);
  if (rows.length) {
    const code = randomCode();
    await pool.execute(
      "UPDATE users SET reset_code_hash = ?, reset_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) WHERE id = ?",
      [signCode(code), rows[0].id]
    );
    if (!resend || !process.env.RESEND_FROM_EMAIL) return res.status(503).json({ error: "Password reset email is not configured on this server." });
    await sendVerificationCode(email, code, "Reset your Study Space password");
  }
  res.json({ message: "If an account exists for that email, a password reset code has been sent." });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  const password = String(req.body.password || "");
  if (!emailPattern.test(email) || !/^\d{6}$/.test(code) || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Enter your email, 6-digit code, and a password between 8 and 128 characters." });
  }
  const [rows] = await pool.execute(
    "SELECT id, reset_code_hash FROM users WHERE email = ? AND reset_expires_at > UTC_TIMESTAMP()",
    [email]
  );
  if (!rows.length || !rows[0].reset_code_hash || !crypto.timingSafeEqual(Buffer.from(signCode(code)), Buffer.from(rows[0].reset_code_hash))) {
    return res.status(400).json({ error: "That code is invalid or has expired." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute("UPDATE users SET password_hash = ?, reset_code_hash = NULL, reset_expires_at = NULL WHERE id = ?", [passwordHash, rows[0].id]);
  await pool.execute("DELETE FROM sessions WHERE user_id = ?", [rows[0].id]);
  res.json({ message: "Password updated. You can now sign in." });
});

app.get("/auth/google", (req, res) => {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return res.status(503).send("Google sign-in is not configured on this server.");
  }
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie("google_oauth_state", state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  }).toString();
  res.redirect(url.toString());
});

app.get("/auth/google/callback", async (req, res) => {
  if (!req.query.code || !req.query.state || req.query.state !== req.cookies?.google_oauth_state) {
    return res.status(400).send("Invalid Google sign-in state.");
  }
  res.clearCookie("google_oauth_state", { ...cookieOptions, maxAge: undefined });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(req.query.code),
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return res.status(401).send("Google sign-in could not be completed.");
  const tokens = await tokenResponse.json();
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) return res.status(401).send("Could not retrieve your Google profile.");
  const profile = await profileResponse.json();
  if (!profile.email || !profile.email_verified) return res.status(403).send("Google must confirm your email address.");
  const [users] = await pool.execute("SELECT id FROM users WHERE google_id = ? OR email = ?", [profile.sub, profile.email.toLowerCase()]);
  let userId;
  if (users.length) {
    userId = users[0].id;
    await pool.execute("UPDATE users SET google_id = ?, is_verified = 1 WHERE id = ?", [profile.sub, userId]);
  } else {
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, google_id, is_verified) VALUES (?, ?, ?, 1)",
      [profile.name || profile.email, profile.email.toLowerCase(), profile.sub]
    );
    userId = result.insertId;
  }
  await createSession(userId, res);
  res.redirect("/dashboard.html");
});

const resources = {
  classes: { table: "classes", fields: ["name", "teacher", "color"], required: ["name"] },
  notebooks: { table: "notebooks", fields: ["title", "class_id"], required: ["title"] },
  sources: { table: "sources", fields: ["notebook_id", "title", "file_name", "mime_type", "content", "file_data"], required: ["notebook_id", "title"] },
  notes: { table: "notes", fields: ["notebook_id", "title", "content"], required: ["notebook_id", "title"] },
  "flashcard-sets": { table: "flashcard_sets", fields: ["title", "class_id"], required: ["title"] },
  flashcards: { table: "flashcards", fields: ["set_id", "term", "definition"], required: ["set_id", "term", "definition"] },
  quizzes: { table: "quizzes", fields: ["title", "class_id"], required: ["title"] },
  questions: { table: "questions", fields: ["quiz_id", "prompt", "options_json", "correct_option"], required: ["quiz_id", "prompt", "options_json", "correct_option"] },
  assignments: { table: "assignments", fields: ["class_id", "title", "description", "due_at", "completed"], required: ["title", "due_at"] },
  events: { table: "calendar_events", fields: ["title", "description", "starts_at", "ends_at"], required: ["title", "starts_at"] },
  chats: { table: "chats", fields: ["notebook_id", "title"], required: ["title"] },
};

app.use("/api", requireAuth);

app.get("/api/me", (req, res) => res.json({ user: req.user }));
app.get("/api/config", (_req, res) => res.json({
  emailVerification: Boolean(resend && process.env.RESEND_FROM_EMAIL),
  googleSignIn: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
  aiChat: Boolean(process.env.OPENAI_API_KEY),
}));
app.patch("/api/profile", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name || name.length > 100) return res.status(400).json({ error: "Name must be between 1 and 100 characters." });
  await pool.execute("UPDATE users SET name = ? WHERE id = ?", [name, req.user.id]);
  res.json({ user: { ...req.user, name } });
});
app.get("/api/dashboard", async (req, res) => {
  const [classes] = await pool.execute("SELECT COUNT(*) AS count FROM classes WHERE user_id = ?", [req.user.id]);
  const [notebooks] = await pool.execute("SELECT COUNT(*) AS count FROM notebooks WHERE user_id = ?", [req.user.id]);
  const [assignments] = await pool.execute(
    "SELECT id, title, due_at, completed FROM assignments WHERE user_id = ? AND completed = 0 ORDER BY due_at LIMIT 5",
    [req.user.id]
  );
  const [recent] = await pool.execute("SELECT id, title, updated_at FROM notebooks WHERE user_id = ? ORDER BY updated_at DESC LIMIT 4", [req.user.id]);
  res.json({ stats: { classes: classes[0].count, notebooks: notebooks[0].count }, assignments, notebooks: recent });
});

app.get("/api/quizzes/:id/questions", async (req, res) => {
  const quizId = Number(req.params.id);
  const [quizzes] = await pool.execute("SELECT id FROM quizzes WHERE id = ? AND user_id = ?", [quizId, req.user.id]);
  if (!quizzes.length) return res.status(404).json({ error: "Quiz not found." });
  const [questions] = await pool.execute("SELECT id, quiz_id, prompt, options_json FROM questions WHERE quiz_id = ? AND user_id = ? ORDER BY id", [quizId, req.user.id]);
  res.json(questions);
});

app.get("/api/:resource/:id", async (req, res, next) => {
  const resource = resources[req.params.resource];
  if (!resource) return next();
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item id." });
  const [rows] = await pool.execute(`SELECT * FROM ${resource.table} WHERE id = ? AND user_id = ?`, [id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Item not found." });
  res.json(rows[0]);
});

app.get("/api/:resource", async (req, res) => {
  const resource = resources[req.params.resource];
  if (!resource) return res.status(404).json({ error: "Resource not found." });
  const columns = req.params.resource === "sources" ? "id, user_id, notebook_id, title, file_name, mime_type, created_at" : "*";
  const [rows] = await pool.execute(`SELECT ${columns} FROM ${resource.table} WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id]);
  res.json(rows);
});

app.post("/api/:resource", async (req, res) => {
  const name = req.params.resource;
  const resource = resources[name];
  if (!resource) return res.status(404).json({ error: "Resource not found." });
  const body = req.body || {};
  if (resource.required.some(field => body[field] === undefined || body[field] === null || String(body[field]).trim() === "")) {
    return res.status(400).json({ error: "Please complete all required fields." });
  }
  if (name === "classes" && (!["sage", "blue", "lavender", "peach", "violet", "indigo"].includes(body.color || "violet"))) {
    return res.status(400).json({ error: "Choose a valid class color." });
  }
  const limits = { name: 100, title: 180, teacher: 100, term: 500, file_name: 255, mime_type: 127 };
  for (const [field, limit] of Object.entries(limits)) {
    if (body[field] !== undefined && body[field] !== null && String(body[field]).length > limit) {
      return res.status(400).json({ error: `${field.replaceAll("_", " ")} must be ${limit} characters or fewer.` });
    }
  }
  const relationFields = {
    notebooks: ["class_id", "classes"],
    sources: ["notebook_id", "notebooks"],
    notes: ["notebook_id", "notebooks"],
    "flashcard-sets": ["class_id", "classes"],
    flashcards: ["set_id", "flashcard_sets"],
    quizzes: ["class_id", "classes"],
    questions: ["quiz_id", "quizzes"],
    assignments: ["class_id", "classes"],
    chats: ["notebook_id", "notebooks"],
  };
  const relation = relationFields[name];
  if (relation && body[relation[0]] !== undefined && body[relation[0]] !== null && body[relation[0]] !== "") {
    const [parents] = await pool.execute(`SELECT id FROM ${relation[1]} WHERE id = ? AND user_id = ?`, [body[relation[0]], req.user.id]);
    if (!parents.length) return res.status(404).json({ error: "The linked item was not found in your account." });
  }

  if (name === "questions") {
    let options;
    try { options = typeof body.options_json === "string" ? JSON.parse(body.options_json) : body.options_json; }
    catch { return res.status(400).json({ error: "Question options must be a valid list." }); }
    if (!Array.isArray(options) || options.length < 2 || options.length > 6 ||
        !options.every(option => typeof option === "string" && option.trim().length <= 250) ||
        !Number.isInteger(Number(body.correct_option)) || Number(body.correct_option) < 0 || Number(body.correct_option) >= options.length) {
      return res.status(400).json({ error: "Add 2–6 answer options and select a valid correct answer." });
    }
    body.options_json = JSON.stringify(options);
  }
  if (name === "assignments") body.completed = body.completed ? 1 : 0;
  if (name === "sources" && body.file_data && Buffer.byteLength(body.file_data, "base64") > 5 * 1024 * 1024) return res.status(413).json({ error: "Files must be 5 MB or smaller." });
  if (name === "sources" && body.file_data && !/^[A-Za-z0-9+/]+={0,2}$/.test(body.file_data)) return res.status(400).json({ error: "Invalid file data." });
  if (name === "sources" && body.file_name && !/\.(pdf|txt|docx)$/i.test(body.file_name)) return res.status(400).json({ error: "Upload a PDF, TXT, or DOCX file." });
  if (name === "sources" && String(body.content || "").length > 500000) return res.status(413).json({ error: "Source text is too large." });
  const fields = resource.fields.filter(field => body[field] !== undefined);
  const values = fields.map(field => body[field]);
  const [result] = await pool.execute(
    `INSERT INTO ${resource.table} (user_id${fields.length ? `, ${fields.join(", ")}` : ""}) VALUES (?${fields.map(() => ", ?").join("")})`,
    [req.user.id, ...values]
  );
  const [created] = await pool.execute(`SELECT * FROM ${resource.table} WHERE id = ? AND user_id = ?`, [result.insertId, req.user.id]);
  res.status(201).json(created[0]);
});

app.patch("/api/:resource/:id", async (req, res) => {
  const name = req.params.resource;
  const resource = resources[name];
  if (!resource) return res.status(404).json({ error: "Resource not found." });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item id." });
  const fields = resource.fields.filter(field => req.body?.[field] !== undefined);
  if (!fields.length) return res.status(400).json({ error: "No editable fields were provided." });
  const [owned] = await pool.execute(`SELECT id FROM ${resource.table} WHERE id = ? AND user_id = ?`, [id, req.user.id]);
  if (!owned.length) return res.status(404).json({ error: "Item not found." });
  if (name === "classes" && req.body.color !== undefined && !["sage", "blue", "lavender", "peach", "violet", "indigo"].includes(req.body.color)) {
    return res.status(400).json({ error: "Choose a valid class color." });
  }
  const relationFields = {
    notebooks: ["class_id", "classes"], "flashcard-sets": ["class_id", "classes"],
    quizzes: ["class_id", "classes"], sources: ["notebook_id", "notebooks"],
    notes: ["notebook_id", "notebooks"], flashcards: ["set_id", "flashcard_sets"],
    questions: ["quiz_id", "quizzes"], assignments: ["class_id", "classes"],
    chats: ["notebook_id", "notebooks"],
  };
  const relation = relationFields[name];
  if (relation && req.body[relation[0]] !== undefined && req.body[relation[0]] !== null) {
    const [parents] = await pool.execute(`SELECT id FROM ${relation[1]} WHERE id = ? AND user_id = ?`, [req.body[relation[0]], req.user.id]);
    if (!parents.length) return res.status(404).json({ error: "The linked item was not found in your account." });
  }
  if (name === "assignments" && req.body.completed !== undefined) req.body.completed = req.body.completed ? 1 : 0;
  const values = fields.map(field => req.body[field]);
  await pool.execute(
    `UPDATE ${resource.table} SET ${fields.map(field => `${field} = ?`).join(", ")} WHERE id = ? AND user_id = ?`,
    [...values, id, req.user.id]
  );
  const [updated] = await pool.execute(`SELECT * FROM ${resource.table} WHERE id = ? AND user_id = ?`, [id, req.user.id]);
  res.json(updated[0]);
});

app.delete("/api/:resource/:id", async (req, res) => {
  const name = req.params.resource;
  const resource = resources[name];
  if (!resource) return res.status(404).json({ error: "Resource not found." });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item id." });
  const [result] = await pool.execute(`DELETE FROM ${resource.table} WHERE id = ? AND user_id = ?`, [id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Item not found." });
  res.json({ ok: true });
});

app.post("/api/quizzes/:id/attempts", async (req, res) => {
  const quizId = Number(req.params.id);
  const answers = req.body?.answers;
  if (!Number.isSafeInteger(quizId) || !Array.isArray(answers)) return res.status(400).json({ error: "Invalid quiz submission." });
  const [quizzes] = await pool.execute("SELECT id FROM quizzes WHERE id = ? AND user_id = ?", [quizId, req.user.id]);
  if (!quizzes.length) return res.status(404).json({ error: "Quiz not found." });
  const [questions] = await pool.execute("SELECT id, options_json, correct_option FROM questions WHERE quiz_id = ? AND user_id = ? ORDER BY id", [quizId, req.user.id]);
  const submitted = new Map(answers.map(answer => [Number(answer.questionId), Number(answer.option)]));
  const correct = questions.reduce((count, question) => count + (submitted.get(question.id) === question.correct_option ? 1 : 0), 0);
  const [result] = await pool.execute(
    "INSERT INTO quiz_attempts (user_id, quiz_id, score, total, answers_json) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, quizId, correct, questions.length, JSON.stringify(answers)]
  );
  res.status(201).json({ id: result.insertId, score: correct, total: questions.length, questions });
});

app.post("/api/flashcards/:id/study", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid card id." });
  const [result] = await pool.execute(
    "UPDATE flashcards SET review_count = review_count + 1, last_studied_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ?",
    [id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: "Flashcard not found." });
  res.json({ ok: true });
});

app.get("/api/chats/:id/messages", async (req, res) => {
  const [chats] = await pool.execute("SELECT id FROM chats WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!chats.length) return res.status(404).json({ error: "Conversation not found." });
  const [messages] = await pool.execute("SELECT id, role, content, created_at FROM messages WHERE chat_id = ? AND user_id = ? ORDER BY id", [req.params.id, req.user.id]);
  res.json(messages);
});

app.post("/api/chats/:id/messages", async (req, res) => {
  const chatId = Number(req.params.id);
  const content = String(req.body?.content || "").trim();
  if (!Number.isSafeInteger(chatId) || chatId < 1 || !content || content.length > 10000) return res.status(400).json({ error: "Enter a valid chat and a message between 1 and 10,000 characters." });
  const [chats] = await pool.execute("SELECT id FROM chats WHERE id = ? AND user_id = ?", [chatId, req.user.id]);
  if (!chats.length) return res.status(404).json({ error: "Conversation not found." });
  const [result] = await pool.execute("INSERT INTO messages (user_id, chat_id, role, content) VALUES (?, ?, 'user', ?)", [req.user.id, chatId, content]);
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "Your message was saved, but AI chat is unavailable until OPENAI_API_KEY is configured.", messageId: result.insertId });
  }
  const [history] = await pool.execute(
    "SELECT role, content FROM messages WHERE chat_id = ? AND user_id = ? ORDER BY id DESC LIMIT 20",
    [chatId, req.user.id]
  );
  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a clear, supportive study assistant. Help the student learn without doing graded work for them." },
        ...history.reverse(),
      ],
      max_tokens: 800,
    }),
  });
  if (!aiResponse.ok) {
    const providerError = await aiResponse.json().catch(() => ({}));
    console.error("AI provider error:", providerError.error?.message || aiResponse.status);
    return res.status(502).json({ error: "The AI provider could not answer right now. Your message was saved; please try again." });
  }
  const aiData = await aiResponse.json();
  const answer = aiData.choices?.[0]?.message?.content;
  if (!answer) return res.status(502).json({ error: "The AI provider returned an empty response. Your message was saved." });
  const [saved] = await pool.execute("INSERT INTO messages (user_id, chat_id, role, content) VALUES (?, ?, 'assistant', ?)", [req.user.id, chatId, answer]);
  res.status(201).json({ id: saved.insertId, role: "assistant", content: answer });
});

app.get("/api/notebooks/:id/notes", async (req, res) => {
  const [owned] = await pool.execute("SELECT id FROM notebooks WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!owned.length) return res.status(404).json({ error: "Notebook not found." });
  const [notes] = await pool.execute("SELECT * FROM notes WHERE notebook_id = ? AND user_id = ? ORDER BY updated_at DESC", [req.params.id, req.user.id]);
  const [sources] = await pool.execute("SELECT id, title, file_name, mime_type, created_at FROM sources WHERE notebook_id = ? AND user_id = ? ORDER BY created_at DESC", [req.params.id, req.user.id]);
  res.json({ notes, sources });
});

app.use("/api", (err, _req, res, _next) => {
  console.error("API error:", err.message);
  if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That value is already in use." });
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((err, _req, res, _next) => {
  console.error("Request error:", err.message);
  res.status(500).send("Something went wrong. Please try again.");
});

app.get("/{*path}", (_req, res, next) => {
  res.sendFile(path.join(__dirname, "index.html"), error => error && next(error));
});

app.listen(PORT, () => console.log(`Study Space running at http://localhost:${PORT}`));

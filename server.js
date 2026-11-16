require("dotenv").config({ quiet: true });

const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// Google OAuth: Initiate Google Sign-In
app.get("/auth/google", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session = req.session || {};
  req.session.oauthState = state;
  const redirectUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  redirectUrl.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID");
  redirectUrl.searchParams.set("redirect_uri", process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/auth/google/callback");
  redirectUrl.searchParams.set("response_type", "code");
  redirectUrl.searchParams.set("scope", "openid email profile");
  redirectUrl.searchParams.set("state", state);
  res.redirect(redirectUrl.toString());
});

// Google OAuth Callback
app.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.session?.oauthState;

  if (!code || !storedState || state !== storedState) {
    return res.status(400).json({ error: "Invalid OAuth callback" });
  }

  const tokenUrl = new URL("https://oauth2.googleapis.com/token");
  const formData = new URLSearchParams({
    code: code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/auth/google/callback",
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  const tokens = await tokenResponse.json();
  if (!tokens.access_token) {
    return res.status(400).json({ error: "Failed to get access token" });
  }

  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const googleUser = await userInfoResponse.json();

  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE google_id = ? OR email = ?",
    [googleUser.id, googleUser.email]
  );

  let user;
  if (rows.length > 0) {
    user = rows[0];
    if (!user.google_id) {
      await pool.execute("UPDATE users SET google_id = ? WHERE id = ?", [googleUser.id, user.id]);
    }
  } else {
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, google_id, is_verified) VALUES (?, ?, ?, ?)",
      [googleUser.name || googleUser.email, googleUser.id, googleUser.isVerified ? 1 : 0]
    );
    user = { id: result.insertId, name: googleUser.name || googleUser.email, email: googleUser.email, google_id: googleUser.id, is_verified: googleUser.isVerified || false };
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  res.cookie("session_token", sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.redirect("/dashboard.html");
});

// Email Signup - Send confirmation code
app.post("/auth/signup", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const [existing] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const confirmationCode = generateConfirmationCode();
  const hashedCode = hashConfirmationCode(confirmationCode);
  const confirmationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [result] = await pool.execute(
    "INSERT INTO users (name, email, confirmation_code, confirmation_expiry, is_verified) VALUES (?, ?, ?, ?, ?)",
    [name, email, hashedCode, confirmationExpiry, false]
  );

  console.log(`Confirmation code for ${email}: ${confirmationCode}`);

  res.json({ success: true, message: "Confirmation code sent to email", needsVerification: true });
});

// Email Signin with confirmation code verification
app.post("/auth/signin", async (req, res) => {
  const { email, confirmationCode } = req.body;

  if (!email || !confirmationCode) {
    return res.status(400).json({ error: "Email and confirmation code are required" });
  }

  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);

  if (rows.length === 0) {
    return res.status(404).json({ error: "No account found with this email" });
  }

  const user = rows[0];

  if (user.is_verified !== true) {
    return res.status(403).json({ error: "Account not verified. Please check your email for confirmation code." });
  }

  const isValid = await verifyConfirmationCode(user.confirmation_code, confirmationCode);
  if (!isValid) {
    return res.status(400).json({ error: "Invalid confirmation code" });
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  res.cookie("session_token", sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

  res.json({ success: true, message: "Login successful", user: { id: user.id, name: user.name, email: user.email } });
});

// Verify existing session
app.get("/auth/session", async (req, res) => {
  const sessionToken = req.cookies.session_token;
  if (!sessionToken) {
    return res.json({ isLoggedIn: false });
  }
  res.json({ isLoggedIn: true, sessionToken });
});

// Logout
app.post("/auth/logout", (req, res) => {
  res.clearCookie("session_token");
  res.json({ success: true, message: "Logged out successfully" });
});

// Initialize database: create users table
async function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255),
      google_id VARCHAR(100),
      confirmation_code VARCHAR(255),
      confirmation_expiry DATETIME,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  await pool.execute(createTableQuery);
  console.log("Database initialized - users table ensured");
}
initDatabase().catch(console.error);

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "4000"),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function generateConfirmationCode() {
  return crypto.randomBytes(3).toString("hex");
}

function hashConfirmationCode(code) {
  return bcrypt.hashSync(code, 10);
}

async function verifyConfirmationCode(storedHash, inputCode) {
  return bcrypt.compare(inputCode, storedHash);
}
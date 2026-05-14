const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ===== ENV CHECK =====
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing!");
}

// ===== POSTGRES =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== SAFE INIT (NO CRASH) =====
pool.query(`
CREATE TABLE IF NOT EXISTS docs (
  id SERIAL PRIMARY KEY,
  customer TEXT,
  product TEXT,
  qty TEXT,
  created_at TEXT
)
`).catch(err => {
  console.log("DB INIT ERROR:", err.message);
});

// ===== CREATE DOC =====
app.post("/doc", async (req, res) => {
  const { customer, product, qty } = req.body;
  const created_at = new Date().toISOString();

  try {
    const result = await pool.query(
      "INSERT INTO docs (customer, product, qty, created_at) VALUES ($1,$2,$3,$4) RETURNING id",
      [customer, product, qty, created_at]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.log(err);
    res.status(500).send("DB ERROR");
  }
});

// ===== GET ALL =====
app.get("/docs/default", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM docs ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ===== PDF SAFE VERSION (NO puppeteer crash risk removed) =====
app.get("/pdf/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM docs WHERE id=$1", [req.params.id]);

    if (!result.rows.length) return res.status(404).send("NOT FOUND");

    const row = result.rows[0];

    const qr = await QRCode.toDataURL(
      `ID:${row.id} | ${row.customer} | ${row.product}`
    );

    const html = `
      <html>
      <body>
        <h1>DELIVERY DOC</h1>
        <p>${row.customer}</p>
        <p>${row.product}</p>
        <p>${row.qty}</p>
        <img src="${qr}" />
      </body>
      </html>
    `;

    res.send(html);

  } catch (err) {
    console.log(err);
    res.status(500).send("PDF ERROR");
  }
});

// ===== GLOBAL ERROR HANDLERS =====
process.on("uncaughtException", err => {
  console.log("UNCAUGHT:", err);
});

process.on("unhandledRejection", err => {
  console.log("UNHANDLED:", err);
});

// ===== START =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
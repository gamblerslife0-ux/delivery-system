const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ===== POSTGRES (SUPABASE) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== CREATE TABLE =====
pool.query(`
CREATE TABLE IF NOT EXISTS docs (
  id SERIAL PRIMARY KEY,
  customer TEXT,
  product TEXT,
  qty TEXT,
  created_at TEXT
);
`);

// ===== CREATE DOC =====
app.post("/doc", async (req, res) => {
  const { customer, product, qty } = req.body;
  const created_at = new Date().toISOString();

  try {
    const result = await pool.query(
      "INSERT INTO docs (customer, product, qty, created_at) VALUES ($1, $2, $3, $4) RETURNING id",
      [customer, product, qty, created_at]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.log(err);
    res.status(500).send("DATABASE ERROR");
  }
});

// ===== GET ALL DOCS =====
app.get("/docs/default", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM docs ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ===== FORMAT DATE =====
function formatDate(dateString) {
  const d = new Date(dateString);

  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} | ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ===== PDF (κρατάμε puppeteer όπως είναι) =====
const puppeteer = require("puppeteer");

app.get("/pdf/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM docs WHERE id = $1", [req.params.id]);

    if (!result.rows.length) {
      return res.status(404).send("NOT FOUND");
    }

    const row = result.rows[0];

    const qrData = `
Πελάτης: ${row.customer}
Προϊόν: ${row.product}
Ποσότητα: ${row.qty}
Ημερομηνία: ${formatDate(row.created_at)}
`;

    const qrCodeImage = await QRCode.toDataURL(qrData);

    const html = `
<html><body>
<h1>Δελτίο Αποστολής</h1>
<p>${row.customer}</p>
<p>${row.product}</p>
<p>${row.qty}</p>
<img src="${qrCodeImage}" />
</body></html>
`;

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: "A4" });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);

  } catch (err) {
    console.log(err);
    res.status(500).send("PDF ERROR");
  }
});

// ===== START =====
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
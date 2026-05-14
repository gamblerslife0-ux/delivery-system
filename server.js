const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const puppeteer = require("puppeteer");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===== CREATE TABLE =====
db.run(`
CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer TEXT,
  product TEXT,
  qty TEXT,
  created_at TEXT
)
`);

// ===== CREATE DOC =====
app.post("/doc", (req, res) => {
  const { customer, product, qty } = req.body;

  // store ISO in DB (correct way)
  const created_at = new Date().toISOString();

  db.run(
    "INSERT INTO docs (customer, product, qty, created_at) VALUES (?, ?, ?, ?)",
    [customer, product, qty, created_at],
    function (err) {
      if (err) {
        console.log(err);
        return res.status(500).send("DATABASE ERROR");
      }

      res.json({ id: this.lastID });
    }
  );
});

// ===== GET ALL DOCS =====
app.get("/docs/default", (req, res) => {
  db.all("SELECT * FROM docs ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }

    res.json(rows);
  });
});

// ===== FORMAT DATE (CLEAN + NICE) =====
function formatDate(dateString) {
  const d = new Date(dateString);

  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const date = `${String(d.getDate()).padStart(2, "0")}/` +
               `${String(d.getMonth() + 1).padStart(2, "0")}/` +
               `${d.getFullYear()}`;

  return `${time} | ${date}`;
}

// ===== PDF =====
app.get("/pdf/:id", async (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM docs WHERE id = ?", [id], async (err, row) => {
    if (err) {
      return res.status(500).send("DATABASE ERROR");
    }

    if (!row) {
      return res.status(404).send("NOT FOUND");
    }

    const qrData = `
Πελάτης: ${row.customer}
Προϊόν: ${row.product}
Ποσότητα: ${row.qty}
Ημερομηνία: ${formatDate(row.created_at)}
`;

    const qrCodeImage = await QRCode.toDataURL(qrData);

    const html = `
<html>
<head>
<meta charset="UTF-8">

<style>
  body {
    font-family: Arial;
    padding: 40px;
    background: #fff;
  }

  .container {
    border: 1px solid #000;
    border-radius: 12px;
    width: 420px;
    margin: auto;
    padding: 20px;
  }

  h1 {
    text-align: center;
    margin-bottom: 25px;
    font-size: 26px;
  }

  .field-box {
    border-bottom: 1px dashed #333;
    padding: 10px 0;
    text-align: center;
    font-size: 15px;
  }

  .field-box span {
    font-weight: bold;
  }

  .qr {
    display: block;
    margin: 25px auto;
    width: 110px;
  }

  .footer {
    text-align: center;
    font-size: 12px;
    color: gray;
    margin-top: 15px;
  }
</style>

</head>

<body>
  <div class="container">

    <h1>Δελτίο Αποστολής Αγροτών</h1>

    <div class="field-box">
      <span>ID:</span> ${row.id}
    </div>

    <div class="field-box">
      <span>Ημερομηνία & Ώρα:</span> ${formatDate(row.created_at)}
    </div>

    <div class="field-box">
      <span>Πελάτης:</span> ${row.customer}
    </div>

    <div class="field-box">
      <span>Προϊόν:</span> ${row.product}
    </div>

    <div class="field-box">
      <span>Ποσότητα:</span> ${row.qty}
    </div>

    <img class="qr" src="${qrCodeImage}" />

    <div class="footer">
      Δελτίο Αποστολής Αγροτών
    </div>

  </div>
</body>
</html>
`;

    try {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });

      const page = await browser.newPage();

      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({ format: "A4" });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.send(pdf);

    } catch (e) {
      console.log("PDF ERROR:", e);
      res.status(500).send("PDF ERROR");
    }
  });
});

// ===== START SERVER =====
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
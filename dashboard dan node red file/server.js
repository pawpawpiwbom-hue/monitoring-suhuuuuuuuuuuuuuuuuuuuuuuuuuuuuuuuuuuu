
const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;
const API_KEY = process.env.API_KEY || "iot-rahasia-123";

// Middleware
app.use(cors());
app.use(express.json());

// Gunakan lokasi database yang pasti
const dbPath = path.join(__dirname, "monitoring.db");
const db = new Database(dbPath);

console.log("Database digunakan:", dbPath);

// Membuat tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    threshold REAL NOT NULL
  );

  INSERT OR IGNORE INTO settings (id, threshold)
  VALUES (1, 30);
`);

// Autentikasi
function authenticate(req, res, next) {
  const key = req.headers["x-api-key"];

  if (key !== API_KEY) {
    return res.status(401).json({
      message: "API Key tidak valid"
    });
  }

  next();
}

// Status server dan jumlah data
app.get("/api/status", authenticate, (req, res) => {
  const result = db.prepare(`
    SELECT COUNT(*) AS total FROM history
  `).get();

  res.json({
    status: "Server aktif",
    database: dbPath,
    total_data: result.total
  });
});

// Melihat batas suhu
app.get("/api/threshold", authenticate, (req, res) => {
  const setting = db.prepare(
    "SELECT threshold FROM settings WHERE id = 1"
  ).get();

  res.json(setting);
});

// Mengubah batas suhu
app.put("/api/threshold", authenticate, (req, res) => {
  const threshold = Number(req.body.threshold);

  if (!Number.isFinite(threshold)) {
    return res.status(400).json({
      message: "Threshold harus berupa angka"
    });
  }

  db.prepare(`
    UPDATE settings
    SET threshold = ?
    WHERE id = 1
  `).run(threshold);

  res.json({
    message: "Batas suhu berhasil diperbarui",
    threshold
  });
});

// Menerima dan menyimpan suhu
app.post("/api/temperature", authenticate, (req, res) => {
  const temperature = Number(req.body.temperature);

  if (
    req.body.temperature === undefined ||
    req.body.temperature === null ||
    req.body.temperature === "" ||
    !Number.isFinite(temperature)
  ) {
    return res.status(400).json({
      message: "Data suhu tidak valid"
    });
  }

  const setting = db.prepare(
    "SELECT threshold FROM settings WHERE id = 1"
  ).get();

  const result = db.prepare(`
    INSERT INTO history (temperature)
    VALUES (?)
  `).run(temperature);

  const total = db.prepare(`
    SELECT COUNT(*) AS total FROM history
  `).get();

  const alert = temperature > setting.threshold;

  console.log("DATA SUHU TERSIMPAN:", {
    id: result.lastInsertRowid,
    temperature,
    total: total.total
  });

  res.json({
    message: "Data suhu berhasil disimpan",
    id: result.lastInsertRowid,
    temperature,
    threshold: setting.threshold,
    total_data: total.total,
    alert,
    notification: alert
      ? "PERINGATAN! Suhu melewati batas!"
      : "Suhu normal"
  });
});

// Mengambil riwayat suhu
app.get("/api/history", authenticate, (req, res) => {
  const history = db.prepare(`
    SELECT * FROM history
    ORDER BY id DESC
    LIMIT 100
  `).all();

  res.json(history.reverse());
});

// Menjalankan server
app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("SERVER MONITORING SUHU AKTIF");
  console.log(`http://localhost:${PORT}`);
  console.log("--------------------------------");
});

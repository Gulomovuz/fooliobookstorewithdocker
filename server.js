import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const files = {
  books: path.join(DATA_DIR, "books.json"),
  users: path.join(DATA_DIR, "users.json"),
  orders: path.join(DATA_DIR, "orders.json"),
  carts: path.join(DATA_DIR, "carts.json")
};

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error("JSON read error:", file, err.message);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(files.orders)) writeJson(files.orders, []);
if (!fs.existsSync(files.carts)) writeJson(files.carts, {});
if (!fs.existsSync(files.users)) writeJson(files.users, []);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running", port: PORT });
});

app.get("/api/books", (req, res) => {
  const books = readJson(files.books, []);
  res.json(books);
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email and password are required" });
  }

  const users = readJson(files.users, []);
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ ok: false, error: "Invalid email or password" });
  }

  res.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name }
  });
});

app.post("/api/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ ok: false, error: "Name, email, and password are required" });
  }

  const users = readJson(files.users, []);
  if (users.some(u => u.email === email)) {
    return res.status(409).json({ ok: false, error: "User already exists" });
  }

  const user = { id: makeId("u"), name, email, password };
  users.push(user);
  writeJson(files.users, users);

  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/orders/:userId", (req, res) => {
  const orders = readJson(files.orders, []);
  res.json(orders.filter(o => o.userId === req.params.userId));
});

app.post("/api/orders", (req, res) => {
  const { userId, items, customer, totals, paymentMethod } = req.body;

  if (!userId || !Array.isArray(items) || items.length === 0 || !totals) {
    return res.status(400).json({ ok: false, error: "Order must include userId, items, and totals" });
  }

  const order = {
    orderId: "FLO-" + Date.now().toString(36).toUpperCase(),
    userId,
    items,
    customer: customer || {},
    totals,
    paymentMethod: paymentMethod || "card",
    status: "confirmed",
    createdAt: new Date().toISOString()
  };

  const orders = readJson(files.orders, []);
  orders.push(order);
  writeJson(files.orders, orders);

  res.json({ ok: true, order });
});

// Optional cart API, kept for professor/API demonstration.
app.get("/api/cart/:userId", (req, res) => {
  const carts = readJson(files.carts, {});
  res.json(carts[req.params.userId] || []);
});

app.post("/api/cart", (req, res) => {
  const { userId, cart } = req.body;
  if (!userId || !Array.isArray(cart)) {
    return res.status(400).json({ ok: false, error: "userId and cart array are required" });
  }
  const carts = readJson(files.carts, {});
  carts[userId] = cart;
  writeJson(files.carts, carts);
  res.json({ ok: true, cart: carts[userId] });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n✓ Folio Bookstore running on http://localhost:${PORT}`);
  console.log(`✓ Frontend and backend are served from the same address`);
  console.log(`✓ Health check: http://localhost:${PORT}/api/health\n`);
});

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const SQLiteStore = require('connect-sqlite3')(session);

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session store (SQLite-backed so sessions persist across restarts)
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './database' }),
  secret: process.env.SESSION_SECRET || 'justlanyards_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true
  }
}));

// NOTE: static files served AFTER API routes so API routes take priority

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', (req, res) => {
  const db = require('./database/db');
  db.all('SELECT * FROM categories ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files (HTML, CSS, JS, images) AFTER API routes
app.use(express.static(path.join(__dirname)));

// ── HTML Page Routes ───────────────────────────────────────
const pages = ['cart', 'checkout', 'login', 'register', 'orders', 'products', 'contact'];
pages.forEach(page => {
  app.get(`/${page}`, (req, res) =>
    res.sendFile(path.join(__dirname, `${page}.html`))
  );
});

app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, 'admin', 'index.html'))
);

app.get('/product/:slug', (req, res) =>
  res.sendFile(path.join(__dirname, 'product.html'))
);

app.get('/blog/:slug', (req, res) =>
  res.sendFile(path.join(__dirname, 'blog/post.html'))
);

// ── 404 fallback ───────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Just Lanyards server running at http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   API base:    http://localhost:${PORT}/api\n`);
});

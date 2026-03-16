const express = require('express');
const db = require('../database/db');
const { isAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// File upload config for product images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../images')),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, `product_${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// All admin routes require admin session
router.use(isAdmin);

// ── DASHBOARD STATS ──────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const stats = {};
  const queries = [
    new Promise(r => db.get('SELECT COUNT(*) AS count FROM orders', [], (e, row) => { stats.orders = row?.count || 0; r(); })),
    new Promise(r => db.get('SELECT COALESCE(SUM(total),0) AS total FROM orders', [], (e, row) => { stats.revenue = parseFloat((row?.total || 0).toFixed(2)); r(); })),
    new Promise(r => db.get('SELECT COUNT(*) AS count FROM users WHERE is_admin=0', [], (e, row) => { stats.customers = row?.count || 0; r(); })),
    new Promise(r => db.get('SELECT COUNT(*) AS count FROM products', [], (e, row) => { stats.products = row?.count || 0; r(); })),
    new Promise(r => db.get("SELECT COUNT(*) AS count FROM contacts WHERE replied=0", [], (e, row) => { stats.unread_enquiries = row?.count || 0; r(); })),
    new Promise(r => db.get("SELECT COUNT(*) AS count FROM orders WHERE status='Pending'", [], (e, row) => { stats.pending_orders = row?.count || 0; r(); })),
  ];
  Promise.all(queries).then(() => res.json(stats));
});

// ── PRODUCTS ─────────────────────────────────────────────
// GET /api/admin/products
router.get('/products', (req, res) => {
  db.all(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST /api/admin/products — create product
router.post('/products', upload.single('image'), (req, res) => {
  const { category_id, name, slug, description, price_from, badge, badge_type, in_stock, featured } = req.body;
  const image = req.file ? `images/${req.file.filename}` : req.body.image || null;
  if (!name || !slug || !price_from) return res.status(400).json({ error: 'Name, slug and price are required.' });

  db.run(
    `INSERT INTO products (category_id, name, slug, description, price_from, image, badge, badge_type, in_stock, featured)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [category_id || null, name, slug, description || null, parseFloat(price_from),
     image, badge || null, badge_type || 'default', in_stock == null ? 1 : Number(in_stock), featured ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
});

// PUT /api/admin/products/:id — update product
router.put('/products/:id', upload.single('image'), (req, res) => {
  const { category_id, name, slug, description, price_from, badge, badge_type, in_stock, featured } = req.body;
  const image = req.file ? `images/${req.file.filename}` : req.body.image || null;

  db.run(
    `UPDATE products SET category_id=?, name=?, slug=?, description=?, price_from=?, image=COALESCE(?,image),
     badge=?, badge_type=?, in_stock=?, featured=? WHERE id=?`,
    [category_id || null, name, slug, description || null, parseFloat(price_from),
     image, badge || null, badge_type || 'default', in_stock == null ? 1 : Number(in_stock), featured ? 1 : 0,
     req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Product not found.' });
      res.json({ success: true });
    }
  );
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ success: true });
  });
});

// ── ORDERS ───────────────────────────────────────────────
// GET /api/admin/orders
router.get('/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/admin/orders/:id — order with items
router.get('/orders/:id', (req, res) => {
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (err || !order) return res.status(404).json({ error: 'Order not found.' });
    db.all('SELECT * FROM order_items WHERE order_id = ?', [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, items });
    });
  });
});

// PUT /api/admin/orders/:id — update order status
router.put('/orders/:id', (req, res) => {
  const { status } = req.body;
  const valid = ['Pending', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true });
  });
});

// ── CONTACTS ─────────────────────────────────────────────
// GET /api/admin/contacts
router.get('/contacts', (req, res) => {
  db.all('SELECT * FROM contacts ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PUT /api/admin/contacts/:id/reply — mark as replied
router.put('/contacts/:id/reply', (req, res) => {
  db.run('UPDATE contacts SET replied = 1 WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ── CATEGORIES ───────────────────────────────────────────
// GET /api/admin/categories
router.get('/categories', (req, res) => {
  db.all('SELECT * FROM categories', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── USERS ────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', (req, res) => {
  db.all('SELECT id, name, email, is_admin, created_at FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;

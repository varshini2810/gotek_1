const express = require('express');
const db = require('../database/db');
const router = express.Router();

// GET /api/categories
router.get('/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/products?category=slug&featured=1
router.get('/', (req, res) => {
  const { category, featured } = req.query;
  let sql = `SELECT p.*, c.name AS category_name, c.slug AS category_slug
             FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
  const params = [];

  if (category) {
    sql += ' AND c.slug = ?';
    params.push(category);
  }
  if (featured) {
    sql += ' AND p.featured = 1';
  }
  sql += ' ORDER BY p.id';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/products/search?q=term
router.get('/search', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  db.all(
    `SELECT p.*, c.name AS category_name FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.name LIKE ? OR p.description LIKE ?`,
    [q, q],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /api/products/:slug
router.get('/:slug', (req, res) => {
  db.get(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.slug = ?`,
    [req.params.slug],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Product not found.' });
      res.json(row);
    }
  );
});

// GET /api/blog
router.get('/blog/posts', (req, res) => {
  db.all('SELECT id, title, slug, excerpt, tag, image, created_at FROM blog_posts ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/blog/:slug
router.get('/blog/:slug', (req, res) => {
  db.get('SELECT * FROM blog_posts WHERE slug = ?', [req.params.slug], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Post not found.' });
    res.json(row);
  });
});

module.exports = router;

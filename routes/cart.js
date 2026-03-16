const express = require('express');
const db = require('../database/db');
const router = express.Router();

// Helper: get session ID (use session id or a fallback)
function getSid(req) {
  return req.session.id;
}

// GET /api/cart — get current cart
router.get('/', (req, res) => {
  const sid = getSid(req);
  db.all(
    `SELECT ci.*, p.name, p.slug, p.image AS product_image 
     FROM cart_items ci LEFT JOIN products p ON ci.product_id = p.id
     WHERE ci.session_id = ?`,
    [sid],
    (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const count = items.reduce((sum, i) => sum + i.quantity, 0);
      res.json({ items, total: parseFloat(total.toFixed(2)), count });
    }
  );
});

// POST /api/cart — add item to cart
router.post('/', (req, res) => {
  const { product_id, quantity = 1, customisation } = req.body;
  const sid = getSid(req);
  if (!product_id) return res.status(400).json({ error: 'product_id is required.' });

  db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    // Check if already in cart (same product + customisation)
    db.get(
      'SELECT * FROM cart_items WHERE session_id = ? AND product_id = ? AND (customisation = ? OR (customisation IS NULL AND ? IS NULL))',
      [sid, product_id, customisation || null, customisation || null],
      (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing) {
          db.run(
            'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
            [quantity, existing.id],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ success: true, message: 'Cart updated.' });
            }
          );
        } else {
          db.run(
            `INSERT INTO cart_items (session_id, product_id, product_name, product_image, price, quantity, customisation)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sid, product_id, product.name, product.image, product.price_from, quantity, customisation || null],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.status(201).json({ success: true, message: 'Item added to cart.' });
            }
          );
        }
      }
    );
  });
});

// PUT /api/cart/:id — update item quantity
router.put('/:id', (req, res) => {
  const { quantity } = req.body;
  const sid = getSid(req);

  if (quantity < 1) {
    // Remove the item if quantity is 0 or less
    db.run('DELETE FROM cart_items WHERE id = ? AND session_id = ?', [req.params.id, sid], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Item removed.' });
    });
  } else {
    db.run(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND session_id = ?',
      [quantity, req.params.id, sid],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Cart item not found.' });
        res.json({ success: true });
      }
    );
  }
});

// DELETE /api/cart/:id — remove single item
router.delete('/:id', (req, res) => {
  const sid = getSid(req);
  db.run('DELETE FROM cart_items WHERE id = ? AND session_id = ?', [req.params.id, sid], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Cart item not found.' });
    res.json({ success: true });
  });
});

// DELETE /api/cart — clear entire cart
router.delete('/', (req, res) => {
  const sid = getSid(req);
  db.run('DELETE FROM cart_items WHERE session_id = ?', [sid], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Cart cleared.' });
  });
});

module.exports = router;

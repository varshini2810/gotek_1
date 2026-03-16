const express = require('express');
const db = require('../database/db');
const router = express.Router();

// Reusable email sender (same pattern as contact.js)
function sendEmail(to, subject, html) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass || user === 'your@gmail.com') return Promise.resolve();
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user, pass }
    });
    return transporter.sendMail({ from: `"Just Lanyards" <${user}>`, to, subject, html });
  } catch (e) {
    console.warn('Order email not sent:', e.message);
    return Promise.resolve();
  }
}

function genOrderRef() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `JL-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// POST /api/orders — place an order (checkout)
router.post('/', (req, res) => {
  const sid = req.session.id;
  const userId = req.session.userId || null;
  const { first_name, last_name, email, phone, address_line1, address_line2, city, postcode, country, notes } = req.body;

  if (!first_name || !last_name || !email || !address_line1 || !city || !postcode)
    return res.status(400).json({ error: 'Please fill in all required address fields.' });

  db.all('SELECT * FROM cart_items WHERE session_id = ?', [sid], (err, items) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!items || !items.length) return res.status(400).json({ error: 'Your cart is empty.' });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = parseFloat(subtotal.toFixed(2));
    const orderRef = genOrderRef();

    db.run(
      `INSERT INTO orders (user_id, order_ref, first_name, last_name, email, phone,
        address_line1, address_line2, city, postcode, country, notes, subtotal, delivery, total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, orderRef, first_name, last_name, email, phone || null,
       address_line1, address_line2 || null, city, postcode, country || 'United Kingdom',
       notes || null, total, 0, total],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const orderId = this.lastID;

        const stmt = db.prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price, customisation)
           VALUES (?,?,?,?,?,?,?)`
        );
        items.forEach(i => stmt.run(orderId, i.product_id, i.product_name, i.product_image, i.quantity, i.price, i.customisation || null));
        stmt.finalize();

        db.run('DELETE FROM cart_items WHERE session_id = ?', [sid]);

        // ── Email confirmation to customer ────────────────
        const itemsHtml = items.map(i =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px;">${i.product_name}</td>
            <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;">${i.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;color:#f07d00;">£${(i.price * i.quantity).toFixed(2)}</td>
          </tr>`
        ).join('');

        const customerHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#001b38;padding:24px 30px;">
              <h2 style="color:#f07d00;margin:0;">JUST LANYARDS</h2>
              <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">Order Confirmation</p>
            </div>
            <div style="padding:30px;background:#fff;border:1px solid #e0e0e0;">
              <h3 style="color:#001b38;">Thank you for your order, ${first_name}! 🎉</h3>
              <p style="color:#555;">Your order has been received and is being processed. We'll be in touch once it's on its way!</p>
              <div style="background:#f9f9f9;border-radius:4px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 6px;font-size:13px;color:#777;">ORDER REFERENCE</p>
                <p style="margin:0;font-size:22px;font-weight:700;color:#f07d00;">${orderRef}</p>
              </div>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead><tr style="background:#f9f9f9;">
                  <th style="padding:8px;text-align:left;font-size:12px;color:#555;text-transform:uppercase;">Product</th>
                  <th style="padding:8px;text-align:center;font-size:12px;color:#555;text-transform:uppercase;">Qty</th>
                  <th style="padding:8px;text-align:right;font-size:12px;color:#555;text-transform:uppercase;">Total</th>
                </tr></thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 8px;font-size:14px;color:#555;">Delivery</td><td style="padding:6px 8px;text-align:right;color:green;font-weight:bold;">FREE</td></tr>
                <tr style="border-top:2px solid #e0e0e0;">
                  <td style="padding:8px;font-size:16px;font-weight:700;color:#001b38;">Total</td>
                  <td style="padding:8px;text-align:right;font-size:18px;font-weight:700;color:#f07d00;">£${total.toFixed(2)}</td>
                </tr>
              </table>
              <div style="background:#e8f5e9;border-radius:3px;padding:12px 16px;margin-top:20px;">
                <strong style="color:#2e7d32;font-size:13px;">📦 Delivery Address</strong>
                <p style="margin:6px 0 0;font-size:13px;color:#555;">${first_name} ${last_name}<br/>${address_line1}${address_line2 ? ', ' + address_line2 : ''}<br/>${city}, ${postcode}<br/>${country || 'United Kingdom'}</p>
              </div>
              <p style="margin-top:20px;color:#555;font-size:14px;">Expected delivery: <strong>3 weeks (Free Standard)</strong><br/>Questions? Call <a href="tel:01257483587" style="color:#f07d00;">01257 483 587</a></p>
            </div>
            <div style="background:#f9f9f9;padding:16px 30px;text-align:center;font-size:12px;color:#aaa;">
              &copy; 2024 Just Lanyards Ltd | Unit 1, Euxton Lane, Chorley, Lancashire
            </div>
          </div>`;

        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        Promise.all([
          sendEmail(email, `Order Confirmation – ${orderRef} | Just Lanyards`, customerHtml),
          adminEmail ? sendEmail(adminEmail, `[New Order] ${orderRef} – £${total.toFixed(2)} from ${first_name} ${last_name}`, customerHtml) : Promise.resolve()
        ]).catch(() => {});

        res.status(201).json({ success: true, order: { id: orderId, order_ref: orderRef, total, status: 'Pending' } });
      }
    );
  });
});

// GET /api/orders — order history (requires login)
router.get('/', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required.' });
  db.all(
    'SELECT id, order_ref, first_name, last_name, email, total, status, created_at FROM orders WHERE user_id = ? ORDER BY id DESC',
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /api/orders/:ref — order detail
router.get('/:ref', (req, res) => {
  db.get('SELECT * FROM orders WHERE order_ref = ?', [req.params.ref], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, items });
    });
  });
});

module.exports = router;

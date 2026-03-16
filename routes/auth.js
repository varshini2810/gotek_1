const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (existing) return res.status(409).json({ error: 'Email already registered.' });

    const hash = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash],
      function (err) {
        if (err) return res.status(500).json({ error: 'Registration failed.' });
        req.session.userId = this.lastID;
        req.session.userName = name;
        req.session.isAdmin = false;
        res.status(201).json({ success: true, user: { id: this.lastID, name, email } });
      }
    );
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.isAdmin = user.is_admin === 1;

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin === 1 }
    });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  db.get('SELECT id, name, email, is_admin FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err || !user) return res.json({ user: null });
    res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin === 1 } });
  });
});

module.exports = router;

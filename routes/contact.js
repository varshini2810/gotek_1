const express = require('express');
const db = require('../database/db');
const router = express.Router();

// Lazy-load nodemailer (only if configured in .env)
function sendEmail(to, subject, html) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass || user === 'your@gmail.com') return Promise.resolve(); // skip if not configured

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user, pass }
    });
    return transporter.sendMail({
      from: `"Just Lanyards" <${user}>`,
      to,
      subject,
      html
    });
  } catch (e) {
    console.warn('Email not sent:', e.message);
    return Promise.resolve();
  }
}

// POST /api/contact — submit a contact/enquiry form
router.post('/', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  db.run(
    'INSERT INTO contacts (name, email, phone, subject, message) VALUES (?,?,?,?,?)',
    [name, email, phone || null, subject || null, message],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to submit enquiry.' });
      const id = this.lastID;

      // Send confirmation email to customer
      const customerHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#001b38;padding:24px 30px;">
            <h2 style="color:#f07d00;margin:0;font-size:22px;">JUST LANYARDS</h2>
            <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">UK's Premier Lanyard Specialist</p>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e0e0e0;">
            <h3 style="color:#001b38;">Thank you for your enquiry, ${name.split(' ')[0]}!</h3>
            <p style="color:#555;">We've received your message and one of our team members will be in touch within <strong>24 hours</strong>.</p>
            <div style="background:#f9f9f9;border-left:4px solid #f07d00;padding:14px 18px;margin:20px 0;border-radius:2px;">
              <p style="margin:0;font-size:13px;color:#555;"><strong>Subject:</strong> ${subject || 'General Enquiry'}</p>
              <p style="margin:8px 0 0;font-size:13px;color:#555;"><strong>Message:</strong> ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
            </div>
            <p style="color:#555;font-size:14px;">Need urgent help? Call us on <a href="tel:01257483587" style="color:#f07d00;font-weight:bold;">01257 483 587</a> (Mon–Fri, 9am–5pm).</p>
          </div>
          <div style="background:#f9f9f9;padding:16px 30px;text-align:center;font-size:12px;color:#aaa;border-top:1px solid #e0e0e0;">
            &copy; 2024 Just Lanyards Ltd, Unit 1, Euxton Lane, Chorley, Lancashire, PR7 6AB
          </div>
        </div>`;

      // Send notification to admin
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
      const adminHtml = `<p><strong>New enquiry #${id}</strong></p>
        <p>From: ${name} (${email})</p>
        <p>Phone: ${phone || 'N/A'}</p>
        <p>Subject: ${subject || 'N/A'}</p>
        <p>Message: ${message}</p>
        <a href="http://localhost:${process.env.PORT || 3000}/admin">View in Admin Panel</a>`;

      Promise.all([
        sendEmail(email, 'We Received Your Enquiry – Just Lanyards', customerHtml),
        adminEmail ? sendEmail(adminEmail, `[New Enquiry] ${subject || 'General'} from ${name}`, adminHtml) : Promise.resolve()
      ]).catch(() => {}); // Non-blocking

      res.status(201).json({
        success: true,
        message: 'Thank you for your enquiry! We will get back to you within 24 hours.',
        id
      });
    }
  );
});

module.exports = router;

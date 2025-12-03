// server.js
// Simple email & declaration API for Neon Voting App
// WARNING: This example is for prototyping. Add auth (API key / JWT) before production.

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors()); // configure origin in production
app.use(bodyParser.json({ limit: '1mb' }));

// Optional: simple API key check - enable in production by setting API_KEY in .env
const API_KEY = process.env.API_KEY || '';

function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // if API_KEY not set, skip check (dev mode)
  const key = req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey;
  if (!key || key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Configure transporter using env vars
// .env should contain SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Test route
app.get('/ping', (req, res) => res.json({ ok: true }));

// Send single email (vote receipt)
app.post('/send-receipt', requireApiKey, async (req, res) => {
  const { to, subject, html, text } = req.body;
  if (!to || !subject || !(html || text)) return res.status(400).json({ error: 'missing fields' });

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'Neon Voting'}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      text: text || '',
      html: html || ''
    });
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('send-receipt error', err);
    return res.status(500).json({ error: 'send_failed', details: err.message });
  }
});

// Send bulk emails (array of {to, subject, html})
app.post('/send-bulk', requireApiKey, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

  try {
    const results = [];
    for (const m of messages) {
      if (!m.to || !m.subject || !(m.html || m.text)) { results.push({ ok: false, reason: 'missing fields', to: m.to }); continue; }
      try {
        const info = await transporter.sendMail({
          from: `"${process.env.FROM_NAME || 'Neon Voting'}" <${process.env.FROM_EMAIL}>`,
          to: m.to,
          subject: m.subject,
          text: m.text || '',
          html: m.html || ''
        });
        results.push({ ok: true, to: m.to, info });
      } catch (err) {
        results.push({ ok: false, to: m.to, error: err.message });
      }
    }
    return res.json({ ok: true, results });
  } catch (err) {
    console.error('send-bulk error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Declaration endpoint: client sends org info + results HTML; server sends notification to all voters
// Body: { orgId, subject, html, recipients: [email,...] }
app.post('/declare', requireApiKey, async (req, res) => {
  const { orgId, subject, html, recipients } = req.body;
  if (!orgId || !subject || !html || !Array.isArray(recipients)) return res.status(400).json({ error: 'missing fields' });

  try {
    const results = [];
    for (const to of recipients) {
      try {
        const info = await transporter.sendMail({
          from: `"${process.env.FROM_NAME || 'Neon Voting'}" <${process.env.FROM_EMAIL}>`,
          to,
          subject,
          html
        });
        results.push({ to, ok: true, info });
      } catch (err) {
        results.push({ to, ok: false, error: err.message });
      }
    }
    return res.json({ ok: true, results });
  } catch (err) {
    console.error('declare error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Close endpoint: optional — for logging; does not alter frontend storage
app.post('/close-election', requireApiKey, (req, res) => {
  const { orgId } = req.body;
  if (!orgId) return res.status(400).json({ error: 'orgId required' });
  // This server is stateless in this example; log or integrate with backend DB here
  console.log('Election closed for', orgId);
  return res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

// ============================================
// STATIC FILE SERVING
// ============================================

// Serve all static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        server: "Voting App",
        emailConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
        time: new Date().toISOString()
    });
});

// Serve index.html for all other GET requests
app.get("*", (req, res) => {
    res.sendFile(require("path").join(__dirname, "index.html"));
});

app.listen(PORT, () => console.log(`Email API running on port ${PORT}`));
// Add this test route (after line 7, before other routes)
app.get('/check-email-setup', (req, res) => {
    const isConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;
    
    res.json({
        status: isConfigured ? '✅ Email configured' : '❌ Email NOT configured',
        smtpUser: process.env.SMTP_USER || 'Not set',
        smtpPassSet: !!process.env.SMTP_PASS,
        fromEmail: process.env.FROM_EMAIL || 'Not set',
        serverTime: new Date().toISOString()
    });
});
// Add this to server.js (near the top, before routes)
const express = require('express');
const app = express();
const path = require('path');

// Serve static files (HTML, CSS, JS)
app.use(express.static('.'));

// ... rest of your email API code ...

// Voting App Server with Static File Serving
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// ========== STATIC FILE SERVING ==========
app.use(express.static(__dirname));

// ========== EMAIL API (from original) ==========
const API_KEY = process.env.API_KEY || "";
function requireApiKey(req, res, next) {
    if (!API_KEY) return next();
    const key = req.headers["x-api-key"] || req.query.apiKey || req.body.apiKey;
    if (!key || key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Email endpoints from original server.js
app.post("/send-email", requireApiKey, async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;
        if (!to || !subject || !(text || html)) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const info = await transporter.sendMail({
            from: `"${process.env.FROM_NAME || "Neon Voting"}" <${process.env.FROM_EMAIL}>`,
            to, subject, text: text || "", html: html || "",
        });
        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error("Email error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Add other email endpoints if they exist in original
app.post("/send-bulk", requireApiKey, (req, res) => {
    res.json({ message: "Bulk email - implement as needed" });
});

app.post("/send-template", requireApiKey, (req, res) => {
    res.json({ message: "Template email - implement as needed" });
});

// ========== NEW ENDPOINTS ==========
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        server: "Voting App",
        emailConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
        time: new Date().toISOString(),
    });
});

app.get("/check-email-setup", (req, res) => {
    res.json({
        status: process.env.SMTP_USER ? "? Email configured" : "? Email NOT configured",
        smtpUser: process.env.SMTP_USER || "Not set",
        smtpPassSet: !!process.env.SMTP_PASS,
        fromEmail: process.env.FROM_EMAIL || "Not set",
        serverTime: new Date().toISOString(),
    });
});

// ========== SERVE HTML FOR ALL OTHER ROUTES ==========
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`? Voting App Server: http://localhost:${PORT}`);
    console.log(`?? Email: ${process.env.SMTP_USER ? "Configured" : "Not configured"}`);
    console.log(`?? Serving: ${__dirname}`);
});

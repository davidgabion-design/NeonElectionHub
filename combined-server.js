const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve all static files

// API Key middleware (optional)
const API_KEY = process.env.API_KEY;
const apiKeyCheck = (req, res, next) => {
    if (!API_KEY) return next(); // Skip if no API_KEY set
    const key = req.headers["x-api-key"] || req.query.apiKey || req.body.apiKey;
    if (!key || key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
};

// Email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Email API endpoints
app.post("/send-email", apiKeyCheck, async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;
        if (!to || !subject || !(text || html)) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const info = await transporter.sendMail({
            from: `"${process.env.FROM_NAME || "Voting App"}" <${process.env.FROM_EMAIL}>`,
            to,
            subject,
            text: text || "",
            html: html || "",
        });

        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error("Email error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        server: "Voting App",
        port: PORT,
        time: new Date().toISOString(),
        emailConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    });
});

// Serve index.html for all other routes (SPA support)
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(PORT, () => {
    console.log(`?? Voting App running on http://localhost:${PORT}`);
    console.log(`?? Email configured: ${!!process.env.SMTP_USER}`);
    console.log(`?? Serving static files from: ${__dirname}`);
});

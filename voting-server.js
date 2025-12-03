const express = require("express");
const path = require("path");

const app = express();
const PORT = 3001;

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Test endpoint
app.get("/test", (req, res) => {
    res.json({ 
        message: "Voting App Server is working!", 
        time: new Date().toISOString(),
        port: PORT
    });
});

// Health check
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok",
        server: "Voting App",
        port: PORT,
        time: new Date().toISOString()
    });
});

// Serve index.html for all routes
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Start server
app.listen(PORT, () => {
    console.log("╔═══════════════════════════════════════════╗");
    console.log("║         VOTING APP SERVER               ║");
    console.log("╠═══════════════════════════════════════════╣");
    console.log(`║ 🌐 Local:    http://localhost:${PORT}        ║`);
    console.log(`║ 🌐 Network:  http://127.0.0.1:${PORT}        ║`);
    console.log(`║ 🩺 Health:   http://localhost:${PORT}/health ║`);
    console.log("║ 📁 Serving current directory              ║");
    console.log("╚═══════════════════════════════════════════╝");
    console.log("");
    console.log("Press Ctrl+C to stop the server");
});

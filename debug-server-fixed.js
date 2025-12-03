const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(express.static(__dirname));

// Debug endpoint
app.get('/debug', (req, res) => {
    res.json({
        server: 'working',
        port: PORT,
        time: new Date().toISOString(),
        files: ['index.html', 'style.css', 'script.js'],
        note: 'Check browser console for JavaScript errors'
    });
});

// Serve index.html for all other routes (FIXED)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle other routes - this is the fix!
app.get('/*', (req, res) => {
    console.log(`${new Date().toISOString()} - Serving: ${req.url}`);
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`?? Debug server on http://localhost:${PORT}`);
    console.log(`?? Serving from: ${__dirname}`);
    console.log(`?? Debug: http://localhost:${PORT}/debug`);
});

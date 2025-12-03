const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(express.static(__dirname));

// Debug endpoint to check if server is working
app.get('/debug', (req, res) => {
    res.json({
        server: 'working',
        port: PORT,
        time: new Date().toISOString(),
        files: ['index.html', 'style.css', 'script.js'],
        note: 'Check browser console for JavaScript errors'
    });
});

// Serve all routes
app.get('*', (req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`?? Debug server on http://localhost:${PORT}`);
    console.log(`?? Serving from: ${__dirname}`);
    console.log(`?? Debug: http://localhost:${PORT}/debug`);
});

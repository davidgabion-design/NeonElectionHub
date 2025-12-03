const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

app.use(express.static(__dirname));

app.get('/test-login', (req, res) => {
    res.json({ 
        status: 'Server working',
        port: PORT,
        time: new Date().toISOString(),
        note: 'This is a test endpoint'
    });
});

app.listen(PORT, () => {
    console.log(`? Test server on http://localhost:${PORT}`);
    console.log(`?? Serving from: ${__dirname}`);
});

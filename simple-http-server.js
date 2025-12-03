const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    
    // Check if file exists
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File not found, serve index.html for SPA routing
                fs.readFile('./index.html', (err, content) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('File not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            // Determine content type
            const extname = path.extname(filePath);
            let contentType = 'text/html';
            
            switch (extname) {
                case '.js': contentType = 'text/javascript'; break;
                case '.css': contentType = 'text/css'; break;
                case '.json': contentType = 'application/json'; break;
                case '.png': contentType = 'image/png'; break;
                case '.jpg': contentType = 'image/jpg'; break;
            }
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`? Simple HTTP server on http://localhost:${PORT}`);
    console.log(`?? Serving from: ${__dirname}`);
    console.log(`??  Using plain HTTP server (no Express routing issues)`);
});

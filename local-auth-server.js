// Local Auth Server for Testing
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Mock user database
const mockUsers = {
    'admin@voting.com': { password: 'admin123', role: 'admin', name: 'Admin User' },
    'super@voting.com': { password: 'super2024', role: 'superadmin', name: 'Super Admin' },
    'user@voting.com': { password: 'user123', role: 'user', name: 'Regular User' }
};

// Auth endpoints
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    
    const user = mockUsers[email];
    if (user && user.password === password) {
        // Create a simple token (in production, use JWT)
        const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
        
        return res.json({
            success: true,
            message: 'Login successful',
            user: {
                email: email,
                name: user.name,
                role: user.role,
                token: token
            }
        });
    } else {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid email or password' 
        });
    }
});

app.post('/api/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});

app.get('/api/check-auth', (req, res) => {
    const token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
        res.json({ authenticated: true, message: 'User is authenticated' });
    } else {
        res.json({ authenticated: false, message: 'Not authenticated' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        server: 'Local Auth Server',
        port: PORT,
        time: new Date().toISOString()
    });
});

// Serve index.html for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
+-------------------------------------------+
¦      LOCAL AUTH SERVER (Port ${PORT})       ¦
¦-------------------------------------------¦
¦ ?? Local:    http://localhost:${PORT}        ¦
¦ ?? Login:    POST http://localhost:${PORT}/api/login ¦
¦ ?? Serving:  ${__dirname} ¦
+-------------------------------------------+
    `);
    console.log('\nTest accounts:');
    console.log('  • admin@voting.com / admin123');
    console.log('  • super@voting.com / super2024');
    console.log('  • user@voting.com / user123');
});

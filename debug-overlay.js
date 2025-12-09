// debug-overlay.js
(function() {
    'use strict';
    
    function createDebugOverlay() {
        // Check if overlay already exists
        if (document.getElementById('debug-overlay')) return;
        
        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-debug';
        toggleBtn.innerHTML = '🔧 Debug';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.bottom = '10px';
        toggleBtn.style.right = '10px';
        toggleBtn.style.zIndex = '10000';
        toggleBtn.style.background = '#9D00FF';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = 'none';
        toggleBtn.style.padding = '10px 15px';
        toggleBtn.style.borderRadius = '5px';
        toggleBtn.style.cursor = 'pointer';
        
        toggleBtn.onclick = function() {
            const overlay = document.getElementById('debug-overlay');
            if (overlay) {
                overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
            }
        };
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'debug-overlay';
        
        // Append to body
        document.body.appendChild(toggleBtn);
        document.body.appendChild(overlay);
        
        // Update function
        function updateDebugOverlay() {
            const orgId = localStorage.getItem('currentOrgId') || 'NOT SET';
            const ecPassword = localStorage.getItem('currentECPassword') || 'NOT SET';
            const isLoggedIn = localStorage.getItem('isECLoggedIn') || 'false';
            
            overlay.innerHTML = `
                <h3>🔍 EC Login Debug</h3>
                <div class="debug-item">
                    <span class="debug-label">Organization ID:</span><br>
                    <span class="debug-value">${orgId}</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">EC Password:</span><br>
                    <span class="debug-value">${ecPassword ? 'SET' : 'NOT SET'}</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Logged In:</span><br>
                    <span class="debug-value">${isLoggedIn}</span>
                </div>
                <div style="margin-top:10px;text-align:center">
                    <button onclick="localStorage.setItem('currentOrgId','demo.university.2024');localStorage.setItem('currentECPassword','cc123456');localStorage.setItem('isECLoggedIn','true');location.reload()" 
                            style="background:#00C3FF;color:white;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:10px">
                        Set Demo
                    </button>
                    <button onclick="localStorage.clear();location.reload()" 
                            style="background:#ff4444;color:white;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:10px;margin-left:5px">
                        Clear
                    </button>
                </div>
            `;
        }
        
        // Initial update and interval
        updateDebugOverlay();
        setInterval(updateDebugOverlay, 2000);
    }
    
    // Wait for DOM to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDebugOverlay);
    } else {
        createDebugOverlay();
    }
})();

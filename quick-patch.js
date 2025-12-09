// Quick patch for your index.html
// Add this after the existing script in your file

// Auto-check for saved credentials
setTimeout(function() {
    const orgId = localStorage.getItem("currentOrgId");
    const password = localStorage.getItem("currentECPassword");
    const isLoggedIn = localStorage.getItem("isECLoggedIn");
    
    if (orgId && password && isLoggedIn === "true") {
        console.log("Found saved credentials for:", orgId);
        
        // Try to auto-login
        const orgInput = document.getElementById('ec-org-id');
        const passInput = document.getElementById('ec-pass');
        
        if (orgInput && passInput) {
            orgInput.value = orgId;
            passInput.value = password;
            
            // Show notification
            const toast = document.getElementById('toast') || (() => {
                const t = document.createElement('div');
                t.id = 'toast';
                t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 20px;background:rgba(0,195,255,0.9);color:white;border-radius:8px;z-index:1001;';
                document.body.appendChild(t);
                return t;
            })();
            
            toast.textContent = `Auto-filled: ${orgId}`;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }
}, 1000);

// Enhanced logout function
window.logout = function() {
    localStorage.removeItem("currentOrgId");
    localStorage.removeItem("currentECPassword");
    localStorage.removeItem("isECLoggedIn");
    currentECOrg = null;
    showScreen('gatewayScreen');
    showToast('Logged out successfully', 'info');
};

// Quick test function
window.testECWithDemo = function() {
    localStorage.setItem("currentOrgId", "demo.university.2024");
    localStorage.setItem("currentECPassword", "cc123456");
    localStorage.setItem("isECLoggedIn", "true");
    showToast("Demo credentials set! Go to EC Login", "success");
};

// ============================================
// GUARANTEED TAB FIX
// ============================================

console.log('?? Loading guaranteed tab fix...');

// Method 1: Fix on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixTabs);
} else {
    fixTabs();
}

// Method 2: Fix after a delay (for dynamic content)
setTimeout(fixTabs, 1000);

// Method 3: Fix on any click (fallback)
document.addEventListener('click', function(e) {
    if (e.target.matches('[data-super-tab], [data-ec-tab], .tab-btn')) {
        console.log('Tab-like element clicked manually:', e.target);
        handleTabClick(e.target);
    }
});

function fixTabs() {
    console.log('Fixing all tabs...');
    
    // Count tabs
    const superTabs = document.querySelectorAll('[data-super-tab]');
    const ecTabs = document.querySelectorAll('[data-ec-tab]');
    const allTabButtons = document.querySelectorAll('.tab-btn');
    
    console.log('Found:', {
        superTabs: superTabs.length,
        ecTabs: ecTabs.length,
        allTabButtons: allTabButtons.length
    });
    
    // Fix SuperAdmin tabs
    superTabs.forEach(tab => {
        // Remove old, add new
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('SUPER TAB CLICKED:', this.dataset.superTab);
            handleSuperTab(this);
        });
        
        // Visual indicator
        newTab.style.border = '2px solid green';
        newTab.style.cursor = 'pointer';
        newTab.title = 'Click me! (Fixed)';
    });
    
    // Fix EC tabs
    ecTabs.forEach(tab => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('EC TAB CLICKED:', this.dataset.ecTab);
            handleEcTab(this);
        });
        
        newTab.style.border = '2px solid blue';
        newTab.style.cursor = 'pointer';
        newTab.title = 'Click me! (Fixed)';
    });
    
    // Fix any other tab buttons
    allTabButtons.forEach(btn => {
        if (!btn.hasAttribute('data-super-tab') && !btn.hasAttribute('data-ec-tab')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('GENERIC TAB CLICKED:', this.textContent);
                alert('Generic tab clicked: ' + this.textContent);
            });
            
            newBtn.style.border = '2px solid orange';
            newBtn.style.cursor = 'pointer';
        }
    });
    
    console.log('Tab fix applied');
}

function handleSuperTab(tabElement) {
    const tabName = tabElement.dataset.superTab;
    
    // Visual feedback
    tabElement.style.background = '#4CAF50';
    setTimeout(() => {
        tabElement.style.background = '';
    }, 300);
    
    // Show alert (for debugging)
    alert('SuperAdmin Tab: ' + tabName);
    
    // Update active states
    document.querySelectorAll('[data-super-tab]').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelectorAll('[id^="superContent-"]').forEach(c => {
        c.classList.remove('active');
    });
    
    tabElement.classList.add('active');
    const contentId = 'superContent-' + tabName;
    const contentEl = document.getElementById(contentId);
    if (contentEl) {
        contentEl.classList.add('active');
    }
    
    // Call original function if exists
    if (typeof showSuperTab === 'function') {
        showSuperTab(tabName);
    }
}

function handleEcTab(tabElement) {
    const tabName = tabElement.dataset.ecTab;
    
    // Visual feedback
    tabElement.style.background = '#2196F3';
    setTimeout(() => {
        tabElement.style.background = '';
    }, 300);
    
    // Show alert (for debugging)
    alert('EC Tab: ' + tabName);
    
    // Update active states
    document.querySelectorAll('[data-ec-tab]').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelectorAll('[id^="ecContent-"]').forEach(c => {
        c.classList.remove('active');
    });
    
    tabElement.classList.add('active');
    const contentId = 'ecContent-' + tabName;
    const contentEl = document.getElementById(contentId);
    if (contentEl) {
        contentEl.classList.add('active');
    }
    
    // Call original function if exists
    if (typeof showECTab === 'function') {
        // Try to get org ID
        const orgId = document.getElementById('ecOrgId')?.value || 
                     localStorage.getItem('currentOrgId');
        if (orgId) {
            showECTab(tabName, { id: orgId });
        } else {
            showECTab(tabName);
        }
    }
}

// Add debug panel
function addDebugPanel() {
    if (document.getElementById('tab-debug-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'tab-debug-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 99999;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
    `;
    
    panel.innerHTML = `
        <strong>?? Tab Debug Panel</strong><br>
        <button onclick="fixTabs()" style="margin:5px;padding:5px 10px;">Refix Tabs</button>
        <button onclick="location.reload()" style="margin:5px;padding:5px 10px;">Reload Page</button>
        <hr style="margin:10px 0;border-color:#444;">
        <div id="tab-status">Checking tabs...</div>
    `;
    
    document.body.appendChild(panel);
    
    // Update status
    setTimeout(() => {
        const status = {
            superTabs: document.querySelectorAll('[data-super-tab]').length,
            ecTabs: document.querySelectorAll('[data-ec-tab]').length,
            tabContents: document.querySelectorAll('[id^="superContent-"], [id^="ecContent-"]').length
        };
        
        document.getElementById('tab-status').innerHTML = `
            SuperAdmin Tabs: ${status.superTabs}<br>
            EC Tabs: ${status.ecTabs}<br>
            Tab Contents: ${status.tabContents}<br>
            <small>${status.superTabs + status.ecTabs > 0 ? '? Tabs found' : '? No tabs found'}</small>
        `;
    }, 500);
}

// Add debug panel after page loads
setTimeout(addDebugPanel, 1500);

console.log('? Tab fix script loaded');

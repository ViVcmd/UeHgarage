window.addEventListener('load', async () => {
    try {
        await initializeAdmin();
    } catch (error) {
        console.error('Admin initialization failed:', error);
        showError('Failed to initialize admin panel');
    }
});

async function initializeAdmin() {
    showElement('loading-admin');
    
    await checkAdminAuth();
    await loadAllData();
    setupEventListeners();
    startSessionTimer();
    startAutoRefresh();
    
    hideElement('loading-admin');
    showElement('admin-content');
}

async function checkAdminAuth() {
    try {
        const authData = await apiCall('/.auth/me');
        
        if (!authData.clientPrincipal) {
            window.location.href = '/index.html';
            return;
        }
        
        // Check if user is admin
        const adminData = await apiCall('/api/auth/admin-check', {
            method: 'POST',
            body: JSON.stringify({ email: authData.clientPrincipal.userDetails })
        });
        
        if (!adminData.isAdmin) {
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = authData.clientPrincipal;
    } catch (error) {
        console.error('Admin auth check failed:', error);
        window.location.href = '/index.html';
    }
}

async function loadAllData() {
    await Promise.all([
        loadSystemStatus(),
        loadMaintenanceStatus(),
        loadUsers(),
        loadBlacklistedUsers(),
        loadCodeStats(),
        loadActivityLog()
    ]);
}

async function loadSystemStatus() {
    try {
        // System health check
        const healthData = await apiCall('/api/admin/system-health');
        updateSystemHealth(healthData);
        
        // Garage status
        const garageData = await apiCall('/api/garage/status');
        updateAdminGarageStatus(garageData.status);
        
        // Active users count
        const usersData = await apiCall('/api/admin/active-users');
        updateActiveUsers(usersData.count);
        
    } catch (error) {
        console.error('System status load failed:', error);
        updateSystemHealth({ status: 'Error', message: error.message });
    }
}

async function loadMaintenanceStatus() {
    try {
        const data = await apiCall('/api/admin/maintenance');
        document.getElementById('maintenance-mode').checked = data.maintenanceMode;
    } catch (error) {
        console.error('Failed to load maintenance status:', error);
    }
}

async function saveMaintenanceMode() {
    const maintenanceMode = document.getElementById('maintenance-mode').checked;
    
    setButtonLoading('save-maintenance', true);
    
    try {
        await retryOperation(async () => {
            return await apiCall('/api/admin/maintenance', {
                method: 'POST',
                body: JSON.stringify({ maintenanceMode })
            });
        });
        
        showSuccess('Maintenance mode updated successfully');
        await loadActivityLog(); // Refresh activity log
    } catch (error) {
        showError('Failed to update maintenance mode: ' + error.message);
    } finally {
        setButtonLoading('save-maintenance', false);
    }
}

async function loadUsers() {
    try {
        const data = await apiCall('/api/admin/users');
        
        const container = document.getElementById('users-container');
        const userCount = document.getElementById('user-count');
        
        if (userCount) {
            userCount.textContent = data.users.length;
        }
        
        if (container) {
            container.innerHTML = data.users.map(user => `
                <div class="user-item" data-email="${user.email}">
                    <div class="user-info">
                        <span class="user-email">${user.email}</span>
                        <span class="user-status">${user.hasActiveCode ? '🔑 Has Code' : '⭕ No Code'}</span>
                    </div>
                    <div class="user-actions">
                        <button onclick="generateCode('${user.email}')" class="primary-btn">🔑 Generate Code</button>
                        <button onclick="removeUser('${user.email}')" class="danger-btn">🗑️ Remove</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load users:', error);
        showError('Failed to load users');
    }
}

async function addUser() {
    const emailInput = document.getElementById('new-user-email');
    const email = emailInput.value.trim();
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        emailInput.focus();
        return;
    }
    
    setButtonLoading('add-user-btn', true);
    
    try {
        await retryOperation(async () => {
            return await apiCall('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
        });
        
        showSuccess(`User ${email} added successfully`);
        emailInput.value = '';
        await loadUsers();
        await loadActivityLog();
    } catch (error) {
        showError('Failed to add user: ' + error.message);
    } finally {
        setButtonLoading('add-user-btn', false);
    }
}

async function generateCode(email) {
    try {
        const data = await retryOperation(async () => {
            return await apiCall('/api/admin/generate-code', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
        });
        
        if (data.success) {
            // Create a modal to display the code
            showCodeModal(email, data.code, data.expiresAt);
            await loadUsers();
            await loadCodeStats();
            await loadActivityLog();
        } else {
            showError('Failed to generate code');
        }
    } catch (error) {
        showError('Error generating code: ' + error.message);
    }
}

function showCodeModal(email, code, expiresAt) {
    const modal = document.createElement('div');
    modal.className = 'code-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🔑 Access Code Generated</h3>
                <button class="modal-close" onclick="closeCodeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>User:</strong> ${email}</p>
                <p><strong>Code:</strong></p>
                <div class="code-display">
                    <input type="text" value="${code}" readonly id="generated-code">
                    <button onclick="copyCode()" class="copy-btn">📋 Copy</button>
                </div>
                <p><strong>Expires:</strong> ${formatDate(new Date(expiresAt))}</p>
                <div class="modal-warning">
                    ⚠️ This code can only be used once. Make sure to share it securely with the user.
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="copyCode()" class="primary-btn">📋 Copy Code</button>
                <button onclick="closeCodeModal()" class="secondary-btn">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on the code input for easy copying
    setTimeout(() => {
        const codeInput = document.getElementById('generated-code');
        if (codeInput) {
            codeInput.select();
        }
    }, 100);
}

function copyCode() {
    const codeInput = document.getElementById('generated-code');
    if (codeInput) {
        codeInput.select();
        document.execCommand('copy');
        showSuccess('Code copied to clipboard');
    }
}

function closeCodeModal() {
    const modal = document.querySelector('.code-modal');
    if (modal) {
        modal.remove();
    }
}

async function removeUser(email) {
    if (!confirm(`Are you sure you want to remove ${email} from UeH Garage?`)) {
        return;
    }
    
    try {
        await retryOperation(async () => {
            return await apiCall('/api/admin/users', {
                method: 'DELETE',
                body: JSON.stringify({ email })
            });
        });
        
        showSuccess(`User ${email} removed successfully`);
        await loadUsers();
        await loadActivityLog();
    } catch (error) {
        showError('Failed to remove user: ' + error.message);
    }
}

async function blacklistUser() {
    const emailInput = document.getElementById('blacklist-email');
    const email = emailInput.value.trim();
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        emailInput.focus();
        return;
    }
    
    setButtonLoading('blacklist-btn', true);
    
    try {
        await retryOperation(async () => {
            return await apiCall('/api/admin/blacklist', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
        });
        
        showSuccess(`User ${email} blacklisted successfully`);
        emailInput.value = '';
        await loadBlacklistedUsers();
        await loadActivityLog();
    } catch (error) {
        showError('Failed to blacklist user: ' + error.message);
    } finally {
        setButtonLoading('blacklist-btn', false);
    }
}

async function loadBlacklistedUsers() {
    try {
        const data = await apiCall('/api/admin/blacklist');
        
        const container = document.getElementById('blacklisted-users');
        if (container) {
            container.innerHTML = data.blacklisted.map(email => `
                <div class="user-item">
                    <span class="user-email">${email}</span>
                    <button onclick="removeFromBlacklist('${email}')" class="secondary-btn">✅ Remove</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load blacklisted users:', error);
    }
}

async function removeFromBlacklist(email) {
    try {
        await retryOperation(async () => {
            return await apiCall('/api/admin/blacklist', {
                method: 'DELETE',
                body: JSON.stringify({ email })
            });
        });
        
        showSuccess(`User ${email} removed from blacklist`);
        await loadBlacklistedUsers();
        await loadActivityLog();
    } catch (error) {
        showError('Failed to remove from blacklist: ' + error.message);
    }
}

async function loadCodeStats() {
    try {
        const data = await apiCall('/api/admin/code-stats');
        
        const activeCodesEl = document.getElementById('active-codes');
        const expiredCodesEl = document.getElementById('expired-codes');
        
        if (activeCodesEl) activeCodesEl.textContent = data.activeCodes;
        if (expiredCodesEl) expiredCodesEl.textContent = data.expiredCodes;
    } catch (error) {
        console.error('Failed to load code stats:', error);
    }
}

async function cleanupExpiredCodes() {
    setButtonLoading('cleanup-codes-btn', true);
    
    try {
        const data = await apiCall('/api/admin/cleanup-codes', {
            method: 'POST'
        });
        
        showSuccess(`Cleaned up ${data.removedCount} expired codes`);
        await loadCodeStats();
        await loadActivityLog();
    } catch (error) {
        showError('Failed to cleanup codes: ' + error.message);
    } finally {
        setButtonLoading('cleanup-codes-btn', false);
    }
}

async function loadActivityLog() {
    try {
        const data = await apiCall('/api/admin/activity-log');
        
        const container = document.getElementById('activity-log');
        if (container) {
            container.innerHTML = data.activities.map(activity => `
                <div class="log-entry">
                    <span class="log-time">${formatTime(new Date(activity.timestamp))}</span>
                    <span class="log-action">${activity.action}</span>
                    <span class="log-user">${activity.user}</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load activity log:', error);
    }
}

function setupEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = '/.auth/logout';
        });
    }
    
    // Maintenance mode
    const saveMaintenanceBtn = document.getElementById('save-maintenance');
    if (saveMaintenanceBtn) {
        saveMaintenanceBtn.addEventListener('click', saveMaintenanceMode);
    }
    
    // User management
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', addUser);
    }
    
    const newUserInput = document.getElementById('new-user-email');
    if (newUserInput) {
        newUserInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addUser();
            }
        });
    }
    
    // Blacklist management
    const blacklistBtn = document.getElementById('blacklist-btn');
    if (blacklistBtn) {
        blacklistBtn.addEventListener('click', blacklistUser);
    }
    
    const blacklistInput = document.getElementById('blacklist-email');
    if (blacklistInput) {
        blacklistInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                blacklistUser();
            }
        });
    }
    
    // Code cleanup
    const cleanupBtn = document.getElementById('cleanup-codes-btn');
    if (cleanupBtn) {
        cleanupBtn.addEventListener('click', cleanupExpiredCodes);
    }
    
    // Activity log refresh
    const refreshLogBtn = document.getElementById('refresh-log-btn');
    if (refreshLogBtn) {
        refreshLogBtn.addEventListener('click', loadActivityLog);
    }
    
    // User search
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', filterUsers);
    }
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const userItems = document.querySelectorAll('#users-container .user-item');
    
    userItems.forEach(item => {
        const email = item.dataset.email.toLowerCase();
        if (email.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function updateSystemHealth(healthData) {
    const healthEl = document.getElementById('system-health');
    if (healthEl) {
        healthEl.textContent = healthData.status;
        healthEl.className = `status-value ${healthData.status.toLowerCase()}`;
    }
}

function updateAdminGarageStatus(status) {
    const statusEl = document.getElementById('admin-garage-status');
    if (statusEl) {
        statusEl.textContent = status || 'Unknown';
    }
}

function updateActiveUsers(count) {
    const countEl = document.getElementById('active-users');
    if (countEl) {
        countEl.textContent = count || '0';
    }
}

function startAutoRefresh() {
    // Refresh data every 30 seconds
    refreshInterval = setInterval(async () => {
        try {
            await loadSystemStatus();
            await loadCodeStats();
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, 30000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});

// Global functions for onclick handlers
window.generateCode = generateCode;
window.removeUser = removeUser;
window.removeFromBlacklist = removeFromBlacklist;
window.copyCode = copyCode;
window.closeCodeModal = closeCodeModal;

let currentUser = null;
let sessionStartTime = Date.now();
let refreshInterval = null;

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
        const userEmail = getUserEmail();
        
        if (!userEmail) {
            window.location.href = '/index.html';
            return;
        }
        
        const adminData = await apiCall('/api/auth/admin-check', {
            method: 'POST',
            body: JSON.stringify({ email: userEmail })
        });
        
        if (!adminData.isAdmin) {
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = { userDetails: userEmail };
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
        const garageData = await apiCall('/api/garage/status');
        updateAdminGarageStatus(garageData.status);
        
        const usersData = await apiCallWithAuth('/api/admin/active-users');
        updateActiveUsers(usersData.count);
        
        updateSystemHealth({ status: 'Healthy' });
        
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
            return await apiCallWithAuth('/api/admin/maintenance', {
                method:

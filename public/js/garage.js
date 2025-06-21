let userLocation = null;
let currentUser = null;
let statusInterval = null;
let retryCount = 0;

window.addEventListener('load', async () => {
    try {
        await initializeGarage();
    } catch (error) {
        console.error('Garage initialization failed:', error);
        showSystemError('Failed to initialize garage control system');
    }
});

async function initializeGarage() {
    showElement('loading-section');
    updateLoadingMessage('Checking authentication...');
    
    await checkAuth();
    
    updateLoadingMessage('Getting your location...');
    await getUserLocation();
    
    setupEventListeners();
    startStatusUpdates();
    hideElement('loading-section');
}

async function checkAuth() {
    try {
        const userEmail = getUserEmail();
        
        if (!userEmail) {
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = { userDetails: userEmail };
        document.getElementById('user-email').textContent = userEmail;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/index.html';
    }
}

async function getUserLocation() {
    if (!navigator.geolocation) {
        showSystemError('Geolocation is not supported by this browser');
        return;
    }
    
    showElement('location-check');
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: CONFIG.LOCATION_TIMEOUT,
                maximumAge: 300000
            });
        });
        
        userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        
        await checkLocationPermission();
    } catch (error) {
        console.error('Location error:', error);
        showLocationError(error);
    }
}

async function checkLocationPermission() {
    try {
        const data = await retryOperation(async () => {
            return await apiCall('/api/garage/check-location', {
                method: 'POST',
                body: JSON.stringify({ location: userLocation })
            });
        });
        
        hideElement('location-check');
        
        if (data.allowed) {
            showElement('garage-controls');
            updateDistanceInfo(data.distance, data.maxDistance);
            await updateGarageStatus();
        } else {
            showLocationDenied(data.distance, data.maxDistance, data.reason);
        }
    } catch (error) {
        showError('Location check failed: ' + error.message);
        hideElement('location-check');
        showElement('location-denied');
    }
}

async function updateGarageStatus() {
    try {
        const data = await apiCall('/api/garage/status');
        
        const statusText = data.status || 'Unknown';
        document.getElementById('garage-status').innerHTML = 
            `🚗 UeH Garage Status: <span class="status-text">${statusText}</span>`;
        
        const statusLight = document.getElementById('status-light');
        const statusLabel = document.getElementById('status-label');
        
        if (statusLight && statusLabel) {
            statusLight.className = `status-light ${statusText.toLowerCase()}`;
            statusLabel.textContent = statusText;
        }
        
        updateLastAction(`Status updated: ${statusText}`);
    } catch (error) {
        console.error('Status update failed:', error);
        updateLastAction('Status check failed');
    }
}

async function openGarage() {
    if (!userLocation) {
        showError('Location not available. Please refresh the page.');
        return;
    }

    setButtonLoading('open-garage-btn', true);
    
    try {
        const data = await retryOperation(async () => {
            return await apiCallWithAuth('/api/garage/control', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'open',
                    location: userLocation
                })
            });
        });
        
        if (data.success) {
            document.getElementById('garage-status').innerHTML = '🚗 UeH Garage Status: <span class="status-text">Opening...</span>';
            showSuccess('UeH Garage opened successfully!');
            updateLastAction(`Garage opened from ${Math.round(data.distance)}m away`);
            
            setTimeout(updateGarageStatus, 3000);
        } else {
            showError('Failed to open garage: ' + data.message);
            updateLastAction('Garage operation failed');
        }
    } catch (error) {
        console.error('Garage control error:', error);
        showError('Error opening garage: ' + error.message);
        updateLastAction('System error occurred');
    } finally {
        setButtonLoading('open-garage-btn', false);
    }
}

function setupEventListeners() {
    const openBtn = document.getElementById('open-garage-btn');
    if (openBtn) {
        openBtn.addEventListener('click', openGarage);
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAll);
    }
    
    const retryLocationBtn = document.getElementById('retry-location-btn');
    if (retryLocationBtn) {
        retryLocationBtn.addEventListener('click', retryLocation);
    }
    
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => window.location.reload());
    }
}

function startStatusUp

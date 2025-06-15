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
        const authData = await apiCall('/.auth/me');
        
        if (!authData.clientPrincipal) {
            window.location.href = '/index.html';
            return;
        }
        
        currentUser = authData.clientPrincipal;
        document.getElementById('user-email').textContent = currentUser.userDetails;
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
            showLocationDenied(data.distance, data.maxDistance);
        }
    } catch (error) {
        console.error('Location check failed:', error);
        showSystemError('Failed to verify location: ' + error.message);
    }
}

async function updateGarageStatus() {
    try {
        const data = await apiCall('/api/garage/status');
        
        const statusText = data.status || 'Unknown';
        document.getElementById('garage-status').innerHTML = 
            `🚗 UeH Garage Status: <span class="status-text">${statusText}</span>`;
        
        // Update status indicator
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
            return await apiCall('/api/garage/control', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'open',
                    location: userLocation
                })
            });
        });
        
        if (data.success) {
            showSuccess('UeH Garage opened successfully!');
            updateLastAction(`Garage opened from ${Math.round(data.distance)}m away`);
            
            // Update status after delay
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

function startStatusUpdates() {
    // Update status every 30 seconds
    statusInterval = setInterval(updateGarageStatus, CONFIG.STATUS_REFRESH_INTERVAL);
}

function stopStatusUpdates() {
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
}

async function refreshAll() {
    setButtonLoading('refresh-btn', true);
    
    try {
        await updateGarageStatus();
        await checkLocationPermission();
        showSuccess('Status refreshed');
    } catch (error) {
        showError('Refresh failed: ' + error.message);
    } finally {
        setButtonLoading('refresh-btn', false);
    }
}

async function retryLocation() {
    setButtonLoading('retry-location-btn', true);
    hideElement('location-denied');
    
    try {
        await getUserLocation();
    } catch (error) {
        showError('Location retry failed: ' + error.message);
    } finally {
        setButtonLoading('retry-location-btn', false);
    }
}

function updateLoadingMessage(message) {
    const loadingMsg = document.getElementById('loading-message');
    if (loadingMsg) {
        loadingMsg.textContent = message;
    }
}

function updateLastAction(message) {
    const lastActionText = document.getElementById('last-action-text');
    if (lastActionText) {
        lastActionText.textContent = `${formatTime(new Date())} - ${message}`;
    }
}

function updateDistanceInfo(distance, maxDistance) {
    const distanceInfo = document.getElementById('distance-info');
    if (distanceInfo) {
        distanceInfo.textContent = `Distance: ${Math.round(distance)}m (Max: ${maxDistance}m)`;
    }
}

function showLocationDenied(distance, maxDistance) {
    const distanceMessage = document.getElementById('distance-message');
    if (distanceMessage) {
        distanceMessage.textContent = 
            `You are ${Math.round(distance)}m away from UeH Garage. Maximum allowed distance is ${maxDistance}m.`;
    }
    showElement('location-denied');
}

function showLocationError(error) {
    let message = 'Unable to get your location for UeH Garage access.';
    
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location permissions and refresh.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable. Please check your GPS settings.';
            break;
        case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
    }
    
    showSystemError(message);
}

function showSystemError(message) {
    const errorDetails = document.getElementById('error-details');
    if (errorDetails) {
        errorDetails.textContent = message;
    }
    
    hideElement('loading-section');
    hideElement('location-check');
    hideElement('garage-controls');
    hideElement('location-denied');
    showElement('error-section');
}

function logout() {
    const staySignedIn = document.getElementById('stay-signed-in');
    const shouldStaySignedIn = staySignedIn ? staySignedIn.checked : false;
    
    stopStatusUpdates();
    
    if (!shouldStaySignedIn) {
        // Clear any local storage if needed
        localStorage.removeItem('uehGaragePreferences');
    }
    
    window.location.href = '/.auth/logout';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopStatusUpdates();
});

// Handle visibility change (pause updates when tab not visible)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopStatusUpdates();
    } else {
        startStatusUpdates();
    }
});

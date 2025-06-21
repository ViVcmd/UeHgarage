const CONFIG = {
    API_BASE_URL: '/api',
    APP_NAME: 'UeH Garage',
    VERSION: '1.0.0',
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    SESSION_CHECK_INTERVAL: 300000,
    LOCATION_TIMEOUT: 10000,
    STATUS_REFRESH_INTERVAL: 30000,
    NOTIFICATION_DURATION: 5000,
    SUCCESS_DURATION: 3000
};

// Global utility functions
function showElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
}

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}

function showError(message, duration = CONFIG.NOTIFICATION_DURATION) {
    console.error('UeH Garage Error:', message);
    
    let errorDiv = document.getElementById('error-notification');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-notification';
        errorDiv.className = 'error-notification';
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-text">${message}</span>
            <button class="error-close" onclick="hideError()">×</button>
        </div>
    `;
    errorDiv.style.display = 'block';
    
    setTimeout(() => hideError(), duration);
}

function showSuccess(message, duration = CONFIG.SUCCESS_DURATION) {
    console.log('UeH Garage Success:', message);
    
    let successDiv = document.getElementById('success-notification');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'success-notification';
        successDiv.className = 'success-notification';
        document.body.appendChild(successDiv);
    }
    
    successDiv.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span class="success-text">${message}</span>
            <button class="success-close" onclick="hideSuccess()">×</button>
        </div>
    `;
    successDiv.style.display = 'block';
    
    setTimeout(() => hideSuccess(), duration);
}

function hideError() {
    const errorDiv = document.getElementById('error-notification');
    if (errorDiv) errorDiv.style.display = 'none';
}

function hideSuccess() {
    const successDiv = document.getElementById('success-notification');
    if (successDiv) successDiv.style.display = 'none';
}

function setButtonLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');
    
    if (loading) {
        button.disabled = true;
        if (textSpan) textSpan.style.display = 'none';
        if (loadingSpan) loadingSpan.style.display = 'inline';
    } else {
        button.disabled = false;
        if (textSpan) textSpan.style.display = 'inline';
        if (loadingSpan) loadingSpan.style.display = 'none';
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateAccessCode(code) {
    const re = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return re.test(code);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
        throw new Error('Invalid coordinates provided');
    }

    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function isValidCoordinate(lat, lng) {
    return (
        typeof lat === 'number' && 
        typeof lng === 'number' &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !isNaN(lat) && !isNaN(lng)
    );
}

async function retryOperation(operation, maxAttempts = CONFIG.MAX_RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.warn(`UeH Garage: Attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxAttempts) {
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
    }
}

async function apiCall(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function startSessionTimer() {
    const sessionElement = document.getElementById('session-time');
    if (!sessionElement) return;
    
    const startTime = Date.now();
    
    setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        sessionElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// User email management for Netlify
function setUserEmail(email) {
    localStorage.setItem('ueh_garage_user_email', email);
}

function getUserEmail() {
    return localStorage.getItem('ueh_garage_user_email');
}

function clearUserEmail() {
    localStorage.removeItem('ueh_garage_user_email');
}

// Enhanced API call with user authentication
async function apiCallWithAuth(url, options = {}) {
    const userEmail = getUserEmail();
    
    return await apiCall(url, {
        ...options,
        headers: {
            'x-user-email': userEmail,
            ...options.headers
        }
    });
}

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showError('A system error occurred. Please try again.');
});

// Expose global functions
window.CONFIG = CONFIG;
window.showElement = showElement;
window.hideElement = hideElement;
window.showError = showError;
window.showSuccess = showSuccess;
window.hideError = hideError;
window.hideSuccess = hideSuccess;
window.setButtonLoading = setButtonLoading;
window.validateEmail = validateEmail;
window.validateAccessCode = validateAccessCode;
window.calculateDistance = calculateDistance;
window.isValidCoordinate = isValidCoordinate;
window.retryOperation = retryOperation;
window.apiCall = apiCall;
window.apiCallWithAuth = apiCallWithAuth;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.startSessionTimer = startSessionTimer;
window.setUserEmail = setUserEmail;
window.getUserEmail = getUserEmail;
window.clearUserEmail = clearUserEmail;
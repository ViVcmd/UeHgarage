const CONFIG = {
    API_BASE_URL: '/api',
    APP_NAME: 'UeH Garage',
    VERSION: '1.0.0',
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    SESSION_CHECK_INTERVAL: 300000, // 5 minutes
    LOCATION_TIMEOUT: 10000,
    STATUS_REFRESH_INTERVAL: 30000 // 30 seconds
};

// Utility functions
function showElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
}

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}

function showError(message, duration = 5000) {
    console.error('UeH Garage Error:', message);
    
    // Create or update error notification
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
    
    // Auto-hide after duration
    setTimeout(() => hideError(), duration);
}

function showSuccess(message, duration = 3000) {
    console.log('UeH Garage Success:', message);
    
    // Create or update success notification
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
    
    // Auto-hide after duration
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

// Distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

// Retry mechanism
async function retryOperation(operation, maxAttempts = CONFIG.MAX_RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.warn(`UeH Garage: Attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxAttempts) {
                throw error;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
    }
}

// API helper with error handling
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

// Format time
function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

// Format date
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Session management
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

// Add notification styles
const notificationStyles = `
.error-notification, .success-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.3s ease-out;
    display: none;
}

.error-notification {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
}

.success-notification {
    background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
    color: white;
}

.error-content, .success-content {
    padding: 15px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.error-icon, .success-icon {
    font-size: 1.2em;
}

.error-text, .success-text {
    flex: 1;
    font-weight: 500;
}

.error-close, .success-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.5em;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
}

.error-close:hover, .success-close:hover {
    background: rgba(255, 255, 255, 0.2);
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@media (max-width: 768px) {
    .error-notification, .success-notification {
        left: 20px;
        right: 20px;
        max-width: none;
    }
}
`;

// Inject notification styles
if (!document.getElementById('notification-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'notification-styles';
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showError('An unexpected error occurred. Please refresh the page.');
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showError('A system error occurred. Please try again.');
});

// Export for use in other files
window.CONFIG = CONFIG;
window.showElement = showElement;
window.hideElement = hideElement;
window.showError = showError;
window.showSuccess = showSuccess;
window.setButtonLoading = setButtonLoading;
window.validateEmail = validateEmail;
window.validateAccessCode = validateAccessCode;
window.calculateDistance = calculateDistance;
window.retryOperation = retryOperation;
window.apiCall = apiCall;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.startSessionTimer = startSessionTimer;

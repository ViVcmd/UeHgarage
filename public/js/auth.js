let currentUser = null;
let retryCount = 0;

// Initialize authentication
window.addEventListener('load', async () => {
    try {
        await initializeAuth();
    } catch (error) {
        console.error('Auth initialization failed:', error);
        showError('Failed to initialize authentication system');
    }
});

async function initializeAuth() {
    // Enable Google login button
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.disabled = false;
    }
    
    await checkAuthStatus();
    await checkMaintenanceMode();
    setupEventListeners();
}

async function checkAuthStatus() {
    try {
        const authData = await apiCall('/.auth/me');
        
        if (authData.clientPrincipal) {
            currentUser = authData.clientPrincipal;
            
            // Check if admin
            const adminData = await apiCall('/api/auth/admin-check', {
                method: 'POST',
                body: JSON.stringify({ email: currentUser.userDetails })
            });
            
            if (adminData.isAdmin) {
                window.location.href = '/admin.html';
            } else {
                // Show code entry for regular users
                showElement('code-section');
                hideElement('login-section');
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Continue with normal login flow
    }
}

async function checkMaintenanceMode() {
    try {
        const data = await apiCall('/api/admin/maintenance');
        
        if (data.maintenanceMode) {
            showElement('maintenance-notice');
            hideElement('login-section');
            hideElement('code-section');
        }
    } catch (error) {
        console.error('Maintenance check failed:', error);
    }
}

function setupEventListeners() {
    // Google login button
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleLogin);
    }
    
    // Admin form
    const adminForm = document.getElementById('admin-form');
    if (adminForm) {
        adminForm.addEventListener('submit', handleAdminLogin);
    }
    
    // Code form
    const codeForm = document.getElementById('code-form');
    if (codeForm) {
        codeForm.addEventListener('submit', handleCodeVerification);
    }
    
    // Access code input formatting
    const accessCodeInput = document.getElementById('access-code');
    if (accessCodeInput) {
        accessCodeInput.addEventListener('input', formatAccessCodeInput);
        accessCodeInput.addEventListener('paste', handleCodePaste);
    }
    
    // Back to login button
    const backBtn = document.getElementById('back-to-login');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            hideElement('code-section');
            showElement('login-section');
            currentUser = null;
        });
    }
}

function handleGoogleLogin() {
    setButtonLoading('google-login-btn', true);
    window.location.href = '/.auth/login/google';
}

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('admin-email').value.trim();
    const code = document.getElementById('admin-code').value;
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    if (!code) {
        showError('Please enter the admin code');
        return;
    }
    
    setButtonLoading('admin-form', true);
    
    try {
        const data = await retryOperation(async () => {
            return await apiCall('/api/auth/admin-login', {
                method: 'POST',
                body: JSON.stringify({ email, code })
            });
        });
        
        if (data.success) {
            showSuccess('Admin login successful');
            setTimeout(() => {
                window.location.href = '/admin.html';
            }, 1000);
        } else {
            showError('Invalid admin credentials');
        }
    } catch (error) {
        showError('Admin login failed: ' + error.message);
    } finally {
        setButtonLoading('admin-form', false);
    }
}

async function handleCodeVerification(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showError('No pending authentication. Please sign in first.');
        return;
    }
    
    const code = document.getElementById('access-code').value.trim();
    
    if (!validateAccessCode(code)) {
        showError('Please enter a valid code in format XXXX-XXXX-XXXX');
        return;
    }
    
    setButtonLoading('code-form', true);
    
    try {
        const data = await retryOperation(async () => {
            return await apiCall('/api/auth/verify-code', {
                method: 'POST',
                body: JSON.stringify({ 
                    email: currentUser.userDetails,
                    code: code 
                })
            });
        });
        
        if (data.success) {
            showSuccess('Access code verified successfully');
            setTimeout(() => {
                window.location.href = '/garage.html';
            }, 1000);
        } else {
            showError('Invalid or expired access code');
        }
    } catch (error) {
        showError('Code verification failed: ' + error.message);
    } finally {
        setButtonLoading('code-form', false);
    }
}

function formatAccessCodeInput(e) {
    let value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    // Add dashes at appropriate positions
    if (value.length > 4) {
        value = value.substring(0, 4) + '-' + value.substring(4);
    }
    if (value.length > 9) {
        value = value.substring(0, 9) + '-' + value.substring(9, 13);
    }
    
    e.target.value = value;
}

function handleCodePaste(e) {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text');
    const cleaned = paste.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    if (cleaned.length === 12) {
        const formatted = cleaned.substring(0, 4) + '-' + cleaned.substring(4, 8) + '-' + cleaned.substring(8, 12);
        e.target.value = formatted;
    }
}

// Session timeout handling
let sessionTimeout;

function resetSessionTimeout() {
    clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(() => {
        showError('Session expired. Please sign in again.');
        setTimeout(() => {
            window.location.href = '/logout';
        }, 2000);
    }, CONFIG.SESSION_CHECK_INTERVAL);
}

// Reset timeout on user activity
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetSessionTimeout, true);
});

// Initial session timeout
resetSessionTimeout();

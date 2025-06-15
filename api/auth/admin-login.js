const authHelper = require('../utils/auth-helper');
const bcrypt = require('bcryptjs');

module.exports = async function (context, req) {
    try {
        const { email, code } = req.body;
        
        // Validate inputs
        if (!email || !code) {
            return authHelper.createErrorResponse('Email and code are required', 400);
        }

        if (!authHelper.isValidEmail(email)) {
            return authHelper.createErrorResponse('Invalid email format', 400);
        }

        // Rate limiting for admin login attempts
        const rateLimit = await authHelper.checkRateLimit(`admin_login_${email}`, 3, 30);
        if (!rateLimit.allowed) {
            await authHelper.logSecurityEvent('Admin login rate limit exceeded', { email }, req);
            return authHelper.createErrorResponse('Too many login attempts. Please try again later.', 429);
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminCode = process.env.ADMIN_CODE;
        
        // Verify admin credentials
        if (email === adminEmail && code === adminCode) {
            console.log(`UeH Garage: Admin login successful for ${email}`);
            
            await authHelper.logSecurityEvent('Successful admin login', { email }, req);
            
            context.res = authHelper.createSuccessResponse({
                message: 'Admin login successful'
            });
        } else {
            console.log(`UeH Garage: Admin login failed for ${email}`);
            
            await authHelper.logSecurityEvent('Failed admin login attempt', { 
                email,
                reason: 'Invalid credentials'
            }, req);
            
            context.res = authHelper.createErrorResponse('Invalid admin credentials', 401);
        }

    } catch (error) {
        console.error('Admin login error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

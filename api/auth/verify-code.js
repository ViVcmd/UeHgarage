const database = require('../utils/database');
const authHelper = require('../utils/auth-helper');

module.exports = async function (context, req) {
    try {
        // Check authentication
        const user = authHelper.getUserFromRequest(req);
        if (!user) {
            return authHelper.createErrorResponse('Not authenticated', 401);
        }

        // Rate limiting
        const rateLimit = await authHelper.checkRateLimit(`verify_${user.email}`, 5, 15);
        if (!rateLimit.allowed) {
            await authHelper.logSecurityEvent('Rate limit exceeded', { action: 'verify-code' }, req);
            return authHelper.createErrorResponse('Too many attempts. Please try again later.', 429);
        }

        const { email, code } = req.body;
        
        // Validate inputs
        if (!email || !code) {
            return authHelper.createErrorResponse('Email and code are required', 400);
        }

        if (!authHelper.isValidEmail(email)) {
            return authHelper.createErrorResponse('Invalid email format', 400);
        }

        // Ensure the email matches the authenticated user
        if (email !== user.email) {
            await authHelper.logSecurityEvent('Email mismatch in code verification', { 
                requestedEmail: email, 
                userEmail: user.email 
            }, req);
            return authHelper.createErrorResponse('Email mismatch', 403);
        }

        // Check if user is authorized
        const isAuthorized = await authHelper.isAuthorized(req);
        if (!isAuthorized) {
            await authHelper.logSecurityEvent('Unauthorized code verification attempt', { email }, req);
            return authHelper.createErrorResponse('User not authorized', 403);
        }

        // Validate and use the code
        try {
            await database.validateAndUseCode(email, code);
            
            await authHelper.logSecurityEvent('Successful code verification', { email }, req);
            
            context.res = authHelper.createSuccessResponse({
                message: 'Access code verified successfully'
            });
        } catch (error) {
            await authHelper.logSecurityEvent('Failed code verification', { 
                email, 
                error: error.message 
            }, req);
            
            context.res = authHelper.createErrorResponse('Invalid or expired access code', 401);
        }

    } catch (error) {
        console.error('Code verification error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

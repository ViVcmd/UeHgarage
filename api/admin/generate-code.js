const database = require('../utils/database');
const authHelper = require('../utils/auth-helper');
const crypto = require('crypto');

function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    // Generate 3 groups of 4 characters each
    for (let group = 0; group < 3; group++) {
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (group < 2) {
            result += '-';
        }
    }
    
    return result; // Format: XXXX-XXXX-XXXX
}

module.exports = async function (context, req) {
    try {
        // Check authentication
        const user = authHelper.getUserFromRequest(req);
        if (!user) {
            return authHelper.createErrorResponse('Not authenticated', 401);
        }

        // Check if admin
        if (!authHelper.isAdmin(req)) {
            await authHelper.logSecurityEvent('Non-admin code generation attempt', { 
                email: user.email 
            }, req);
            return authHelper.createErrorResponse('Admin access required', 403);
        }

        const { email, expiresInHours = 24 } = req.body;
        
        if (!email) {
            return authHelper.createErrorResponse('Email is required', 400);
        }

        if (!authHelper.isValidEmail(email)) {
            return authHelper.createErrorResponse('Invalid email format', 400);
        }

        // Validate expiration hours
        if (typeof expiresInHours !== 'number' || expiresInHours < 1 || expiresInHours > 168) {
            return authHelper.createErrorResponse('expiresInHours must be between 1 and 168 (1 week)', 400);
        }

        // Check if user is whitelisted
        const isWhitelisted = await database.isWhitelisted(email);
        if (!isWhitelisted) {
            return authHelper.createErrorResponse('User is not whitelisted', 400);
        }

        // Check if user already has an active code
        const hasActiveCode = await database.hasActiveCode(email);
        if (hasActiveCode) {
            return authHelper.createErrorResponse('User already has an active access code', 409);
        }

        const code = generateAccessCode();
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        
        await database.setCode(email, code, expiresAt);
        
        console.log(`UeH Garage: Access code generated for ${email} by admin ${user.email}`);

        context.res = authHelper.createSuccessResponse({
            message: `Access code generated for ${email}`,
            code: code,
            expiresAt: expiresAt.toISOString(),
            expiresInHours: expiresInHours
        });

    } catch (error) {
        console.error('Code generation error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

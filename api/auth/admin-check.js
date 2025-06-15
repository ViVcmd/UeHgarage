const authHelper = require('../utils/auth-helper');

module.exports = async function (context, req) {
    try {
        const { email } = req.body;
        
        if (!email) {
            return authHelper.createErrorResponse('Email is required', 400);
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        
        context.res = authHelper.createSuccessResponse({
            isAdmin: email === adminEmail
        });

    } catch (error) {
        console.error('Admin check error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

const database = require('../utils/database');
const authHelper = require('../utils/auth-helper');

module.exports = async function (context, req) {
    try {
        // Check authentication
        const user = authHelper.getUserFromRequest(req);
        if (!user) {
            return authHelper.createErrorResponse('Not authenticated', 401);
        }

        // Check if admin
        if (!authHelper.isAdmin(req)) {
            await authHelper.logSecurityEvent('Non-admin blacklist access attempt', { 
                email: user.email 
            }, req);
            return authHelper.createErrorResponse('Admin access required', 403);
        }

        if (req.method === 'GET') {
            const blacklisted = await database.getBlacklist();
            context.res = authHelper.createSuccessResponse({ blacklisted });
        }

        if (req.method === 'POST') {
            const { email } = req.body;
            
            if (!email) {
                return authHelper.createErrorResponse('Email is required', 400);
            }

            if (!authHelper.isValidEmail(email)) {
                return authHelper.createErrorResponse('Invalid email format', 400);
            }

            // Prevent admin from blacklisting themselves
            if (email === user.email) {
                return authHelper.createErrorResponse('Cannot blacklist your own admin account', 403);
            }

            const added = await database.addToBlacklist(email);
            
            if (added) {
                console.log(`UeH Garage: User ${email} blacklisted by admin ${user.email}`);
                context.res = authHelper.createSuccessResponse({
                    message: `User ${email} blacklisted successfully`
                });
            } else {
                context.res = authHelper.createErrorResponse('User already blacklisted', 409);
            }
        }

        if (req.method === 'DELETE') {
            const { email } = req.body;
            
            if (!email) {
                return authHelper.createErrorResponse('Email is required', 400);
            }

            if (!authHelper.isValidEmail(email)) {
                return authHelper.createErrorResponse('Invalid email format', 400);
            }

            const removed = await database.removeFromBlacklist(email);
            
            if (removed) {
                console.log(`UeH Garage: User ${email} removed from blacklist by admin ${user.email}`);
                context.res = authHelper.createSuccessResponse({
                    message: `User ${email} removed from blacklist successfully`
                });
            } else {
                context.res = authHelper.createErrorResponse('User not found in blacklist', 404);
            }
        }

    } catch (error) {
        console.error('Blacklist management error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

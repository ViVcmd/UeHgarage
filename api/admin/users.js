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
            await authHelper.logSecurityEvent('Non-admin user management access attempt', { 
                email: user.email 
            }, req);
            return authHelper.createErrorResponse('Admin access required', 403);
        }

        if (req.method === 'GET') {
            const users = await database.getUsers();
            context.res = authHelper.createSuccessResponse({ users });
        }

        if (req.method === 'POST') {
            const { email } = req.body;
            
            if (!email) {
                return authHelper.createErrorResponse('Email is required', 400);
            }

            if (!authHelper.isValidEmail(email)) {
                return authHelper.createErrorResponse('Invalid email format', 400);
            }

            const added = await database.addUser(email);
            
            if (added) {
                console.log(`UeH Garage: User ${email} added by admin ${user.email}`);
                context.res = authHelper.createSuccessResponse({
                    message: `User ${email} added successfully`
                });
            } else {
                context.res = authHelper.createErrorResponse('User already exists', 409);
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

            // Prevent admin from removing themselves
            if (email === user.email) {
                return authHelper.createErrorResponse('Cannot remove your own admin account', 403);
            }

            const removed = await database.removeUser(email);
            
            if (removed) {
                console.log(`UeH Garage: User ${email} removed by admin ${user.email}`);
                context.res = authHelper.createSuccessResponse({
                    message: `User ${email} removed successfully`
                });
            } else {
                context.res = authHelper.createErrorResponse('User not found', 404);
            }
        }

    } catch (error) {
        console.error('User management error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

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
            return authHelper.createErrorResponse('Admin access required', 403);
        }

        const removedCount = await database.cleanupExpiredCodes();

        console.log(`UeH Garage: ${removedCount} expired codes cleaned up by admin ${user.email}`);

        context.res = authHelper.createSuccessResponse({
            message: `Cleaned up ${removedCount} expired codes`,
            removedCount: removedCount
        });

    } catch (error) {
        console.error('Code cleanup error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

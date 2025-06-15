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

        const limit = parseInt(req.query.limit) || 50;
        const activities = await database.getActivityLog(limit);

        context.res = authHelper.createSuccessResponse({ activities });

    } catch (error) {
        console.error('Activity log error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

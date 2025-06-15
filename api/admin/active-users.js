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

        // Get recent activity to determine active users
        const activities = await database.getActivityLog(100);
        const recentUsers = new Set();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        activities.forEach(activity => {
            if (new Date(activity.timestamp) > oneDayAgo && activity.user !== 'system') {
                recentUsers.add(activity.user);
            }
        });

        context.res = authHelper.createSuccessResponse({
            count: recentUsers.size,
            users: Array.from(recentUsers)
        });

    } catch (error) {
        console.error('Active users error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

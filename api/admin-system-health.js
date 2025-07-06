const database = require('./utils/database');
const authHelper = require('./utils/auth-helper');
const UeHGarageShellyController = require('./utils/shelly');

module.exports = async function (context, req) {
    try {
        // Check authentication
        const user = authHelper.getUserFromRequest(req);
        if (!user) {
            context.res = authHelper.createErrorResponse('Not authenticated', 401);
            return;
        }

        // Check if admin
        if (!authHelper.isAdmin(req)) {
            context.res = authHelper.createErrorResponse('Admin access required', 403);
            return;
        }

        const shelly = new UeHGarageShellyController();

        const [codeStats, activeUsers, settings, shellyHealth] = await Promise.all([
            database.getCodeStats(),
            database.getActiveUsers(),
            database.getSettings(),
            shelly.healthCheck()
        ]);

        context.res = authHelper.createSuccessResponse({
            codeStats,
            activeUsers: activeUsers.count,
            settings,
            shelly: shellyHealth
        });

    } catch (error) {
        console.error('System health error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

const database = require('./utils/database');
const authHelper = require('./utils/auth-helper');

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

        const stats = await database.getCodeStats();

        context.res = authHelper.createSuccessResponse(stats);

    } catch (error) {
        console.error('Code stats error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

const UeHGarageShellyController = require('../utils/shelly');
const authHelper = require('../utils/auth-helper');

module.exports = async function (context, req) {
    try {
        // Check authentication
        const user = authHelper.getUserFromRequest(req);
        if (!user) {
            return authHelper.createErrorResponse('Not authenticated', 401);
        }

        // Check if user is authorized
        const isAuthorized = await authHelper.isAuthorized(req);
        if (!isAuthorized) {
            return authHelper.createErrorResponse('User not authorized', 403);
        }

        // Get Shelly device status
        const shelly = new UeHGarageShellyController();
        const result = await shelly.getStatus();

        if (result.success) {
            context.res = authHelper.createSuccessResponse({
                status: result.status || 'Unknown',
                isOpen: result.isOpen || false,
                lastUpdate: result.lastUpdate,
                deviceOnline: true
            });
        } else {
            context.res = authHelper.createSuccessResponse({
                status: 'Unknown',
                isOpen: false,
                lastUpdate: new Date().toISOString(),
                deviceOnline: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Status check error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

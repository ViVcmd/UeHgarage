const database = require('../utils/database');
const authHelper = require('../utils/auth-helper');

module.exports = async function (context, req) {
    if (req.method === 'GET') {
        // Get maintenance status (public endpoint)
        try {
            const settings = await database.getSettings();
            context.res = authHelper.createSuccessResponse({
                maintenanceMode: settings.maintenanceMode || false,
                lastUpdated: settings.lastUpdated
            });
        } catch (error) {
            console.error('Error getting maintenance status:', error);
            context.res = authHelper.createErrorResponse('Internal server error', 500);
        }
        return;
    }

    if (req.method === 'POST') {
        try {
            // Check authentication
            const user = authHelper.getUserFromRequest(req);
            if (!user) {
                return authHelper.createErrorResponse('Not authenticated', 401);
            }

            // Check if admin
            if (!authHelper.isAdmin(req)) {
                await authHelper.logSecurityEvent('Non-admin maintenance mode access attempt', { 
                    email: user.email 
                }, req);
                return authHelper.createErrorResponse('Admin access required', 403);
            }

            const { maintenanceMode } = req.body;
            
            if (typeof maintenanceMode !== 'boolean') {
                return authHelper.createErrorResponse('maintenanceMode must be a boolean', 400);
            }

            await database.updateSettings({ maintenanceMode });
            
            console.log(`UeH Garage: Maintenance mode set to ${maintenanceMode} by ${user.email}`);

            context.res = authHelper.createSuccessResponse({
                message: `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'}`
            });

        } catch (error) {
            console.error('Error updating maintenance mode:', error);
            context.res = authHelper.createErrorResponse('Internal server error', 500);
        }
    }
};

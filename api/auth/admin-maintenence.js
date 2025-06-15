const database = require('./utils/database');

exports.handler = async (event, context) => {
    if (event.httpMethod === 'GET') {
        // Get maintenance status (public endpoint)
        try {
            const settings = await database.getSettings();
            return {
                statusCode: 200,
                body: JSON.stringify({
                    maintenanceMode: settings.maintenance_mode || false,
                    lastUpdated: settings.lastUpdated
                })
            };
        } catch (error) {
            console.error('Error getting maintenance status:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    }

    if (event.httpMethod === 'POST') {
        try {
            // Check if admin (you'll need to implement admin auth check)
            const userEmail = event.headers['x-user-email'];
            const adminEmail = process.env.ADMIN_EMAIL;
            
            if (userEmail !== adminEmail) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: 'Admin access required' })
                };
            }

            const { maintenanceMode } = JSON.parse(event.body);
            
            if (typeof maintenanceMode !== 'boolean') {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'maintenanceMode must be a boolean' })
                };
            }

            await database.updateSettings({ maintenance_mode: maintenanceMode });
            
            console.log(`UeH Garage: Maintenance mode set to ${maintenanceMode} by ${userEmail}`);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'}`
                })
            };

        } catch (error) {
            console.error('Error updating maintenance mode:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    }

    return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

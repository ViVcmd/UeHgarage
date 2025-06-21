const UeHGarageShellyController = require('./utils/shelly');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get Shelly device status
        const shelly = new UeHGarageShellyController();
        const result = await shelly.getStatus();

        if (result.success) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: result.status || 'Unknown',
                    isOpen: result.isOpen || false,
                    lastUpdate: result.lastUpdate,
                    deviceOnline: true
                })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: 'Unknown',
                    isOpen: false,
                    lastUpdate: new Date().toISOString(),
                    deviceOnline: false,
                    error: result.error
                })
            };
        }

    } catch (error) {
        console.error('Status check error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

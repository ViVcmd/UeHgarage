const { calculateDistance, isInSwitzerland } = require('./utils/geolocation');
const database = require('./utils/database');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { location } = JSON.parse(event.body);
        
        if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Valid location data is required' })
            };
        }

        // Check if location is in Switzerland
        if (!isInSwitzerland(location.lat, location.lng)) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    allowed: false,
                    distance: null,
                    maxDistance: 1000,
                    reason: 'Location outside allowed region'
                })
            };
        }

        // Get garage location and settings
        const settings = await database.getSettings();
        const garageLocation = {
            lat: parseFloat(process.env.GARAGE_LAT),
            lng: parseFloat(process.env.GARAGE_LNG)
        };
        const maxDistance = settings.max_distance_meters || 1000;

        // Calculate distance
        const distance = calculateDistance(
            location.lat, location.lng,
            garageLocation.lat, garageLocation.lng
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                allowed: distance <= maxDistance,
                distance: distance,
                maxDistance: maxDistance,
                accuracy: 'high'
            })
        };

    } catch (error) {
        console.error('Location check error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

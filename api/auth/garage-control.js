const database = require('./utils/database');
const { calculateDistance, isInSwitzerland } = require('./utils/geolocation');
const UeHGarageShellyController = require('./utils/shelly');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get user from Netlify Identity (if using) or custom auth
        const userEmail = event.headers['x-user-email']; // You'll need to implement this
        
        if (!userEmail) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Not authenticated' })
            };
        }

        // Check if user is authorized
        const isAuthorized = await database.isWhitelisted(userEmail) && 
                           !(await database.isBlacklisted(userEmail));
        
        if (!isAuthorized) {
            const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'];
            await database.logActivity('Unauthorized garage control attempt', userEmail, userEmail, ipAddress);
            
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'User not authorized' })
            };
        }

        const { location } = JSON.parse(event.body);
        
        if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Valid location data is required' })
            };
        }

        // Check if location is in Switzerland
        if (!isInSwitzerland(location.lat, location.lng)) {
            const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'];
            await database.logActivity('Garage control from outside Switzerland', userEmail, userEmail, ipAddress);
            
            return {
                statusCode: 403,
                body: JSON.stringify({ 
                    error: 'Access denied: Location outside allowed region' 
                })
            };
        }

        // Get garage location and max distance from settings
        const settings = await database.getSettings();
        const garageLocation = {
            lat: parseFloat(process.env.GARAGE_LAT),
            lng: parseFloat(process.env.GARAGE_LNG)
        };
        const maxDistance = settings.max_distance_meters || 1000;

        // Check location proximity
        const distance = calculateDistance(
            location.lat, location.lng,
            garageLocation.lat, garageLocation.lng
        );

        if (distance > maxDistance) {
            const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'];
            await database.logActivity(
                'Garage control denied - distance', 
                `${Math.round(distance)}m > ${maxDistance}m`, 
                userEmail, 
                ipAddress
            );
            
            return {
                statusCode: 403,
                body: JSON.stringify({
                    error: `Too far from UeH Garage. Distance: ${Math.round(distance)}m, Max: ${maxDistance}m`
                })
            };
        }

        // Control Shelly device
        const shelly = new UeHGarageShellyController();
        const result = await shelly.openGarage();

        if (result.success) {
            await database.logActivity(
                'Garage opened',
                `Distance: ${Math.round(distance)}m`,
                userEmail
            );
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: result.alreadyOpen ? 'UeH Garage was already open' : 'UeH Garage opened successfully',
                    distance: Math.round(distance),
                    status: result.status || 'Open',
                    alreadyOpen: result.alreadyOpen || false
                })
            };
        } else {
            await database.logActivity(
                'Garage control failed',
                result.error,
                userEmail
            );
            
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Failed to control UeH Garage: ' + result.error
                })
            };
        }

    } catch (error) {
        console.error('Garage control error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

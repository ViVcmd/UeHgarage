const { isWithinRange, isInSwitzerland } = require('../utils/geolocation');
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

        // Validate location data
        const userLocation = req.body.location;
        if (!userLocation || typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number') {
            return authHelper.createErrorResponse('Valid location data is required', 400);
        }

        // Check if location is in Switzerland
        if (!isInSwitzerland(userLocation.lat, userLocation.lng)) {
            context.res = authHelper.createSuccessResponse({
                allowed: false,
                distance: null,
                maxDistance: parseInt(process.env.MAX_DISTANCE_METERS) || 1000,
                reason: 'Location outside allowed region'
            });
            return;
        }

        // Get garage location from environment
        const garageLocation = {
            lat: parseFloat(process.env.GARAGE_LAT),
            lng: parseFloat(process.env.GARAGE_LNG)
        };
        
        const maxDistance = parseInt(process.env.MAX_DISTANCE_METERS) || 1000;
        
        // Check location proximity
        const locationCheck = isWithinRange(
            userLocation.lat,
            userLocation.lng,
            garageLocation.lat,
            garageLocation.lng,
            maxDistance
        );

        context.res = authHelper.createSuccessResponse({
            allowed: locationCheck.allowed,
            distance: locationCheck.distance,
            maxDistance: locationCheck.maxDistance,
            accuracy: locationCheck.accuracy
        });

    } catch (error) {
        console.error('Location check error:', error);
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

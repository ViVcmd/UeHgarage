const UeHGarageShellyController = require('../utils/shelly');
const { isWithinRange, isInSwitzerland } = require('../utils/geolocation');
const authHelper = require('../utils/auth-helper');
const database = require('../utils/database');

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
            await authHelper.logSecurityEvent('Unauthorized garage control attempt', { 
                email: user.email 
            }, req);
            return authHelper.createErrorResponse('User not authorized', 403);
        }

        // Rate limiting for garage control
        const rateLimit = await authHelper.checkRateLimit(`garage_control_${user.email}`, 10, 5);
        if (!rateLimit.allowed) {
            await authHelper.logSecurityEvent('Garage control rate limit exceeded', { 
                email: user.email 
            }, req);
            return authHelper.createErrorResponse('Too many control attempts. Please wait.', 429);
        }

        console.log(`UeH Garage: Control request from ${user.email}`);
        
        // Validate location data
        const userLocation = req.body.location;
        if (!userLocation || typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number') {
            return authHelper.createErrorResponse('Valid location data is required', 400);
        }

        // Additional security: Check if location is in Switzerland
        if (!isInSwitzerland(userLocation.lat, userLocation.lng)) {
            await authHelper.logSecurityEvent('Garage control from outside Switzerland', { 
                email: user.email,
                location: userLocation
            }, req);
            return authHelper.createErrorResponse('Access denied: Location outside allowed region', 403);
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
        
        if (!locationCheck.allowed) {
            console.log(`UeH Garage: Access denied - distance ${Math.round(locationCheck.distance)}m exceeds ${maxDistance}m`);
            
            await authHelper.logSecurityEvent('Garage control denied - distance', { 
                email: user.email,
                distance: locationCheck.distance,
                maxDistance: maxDistance
            }, req);
            
            context.res = authHelper.createErrorResponse(
                `Too far from UeH Garage. Distance: ${Math.round(locationCheck.distance)}m, Max: ${maxDistance}m`,
                403
            );
            return;
        }

        // Control Shelly device
        const shelly = new UeHGarageShellyController();
        const result = await shelly.openGarage();

        if (result.success) {
            console.log('UeH Garage: Successfully opened');
            
            await database.logActivity(
                'Garage opened',
                `Distance: ${Math.round(locationCheck.distance)}m`,
                user.email
            );
            
            context.res = authHelper.createSuccessResponse({
                message: result.alreadyOpen ? 'UeH Garage was already open' : 'UeH Garage opened successfully',
                distance: Math.round(locationCheck.distance),
                status: result.status || 'Open',
                alreadyOpen: result.alreadyOpen || false
            });
        } else {
            console.log('UeH Garage: Failed to open -', result.error);
            
            await database.logActivity(
                'Garage control failed',
                result.error,
                user.email
            );
            
            context.res = authHelper.createErrorResponse(
                'Failed to control UeH Garage: ' + result.error,
                500
            );
        }

    } catch (error) {
        console.error('UeH Garage: Control error -', error.message);
        
        const user = authHelper.getUserFromRequest(req);
        await database.logActivity(
            'Garage control error',
            error.message,
            user?.email || 'unknown'
        );
        
        context.res = authHelper.createErrorResponse('Internal server error', 500);
    }
};

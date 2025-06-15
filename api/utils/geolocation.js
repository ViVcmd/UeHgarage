function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
        throw new Error('Invalid coordinates provided');
    }

    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

function isValidCoordinate(lat, lng) {
    return (
        typeof lat === 'number' && 
        typeof lng === 'number' &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !isNaN(lat) && !isNaN(lng)
    );
}

function isInSwitzerland(lat, lng) {
    // Approximate bounds of Switzerland
    const bounds = {
        north: 47.8085,
        south: 45.8180,
        east: 10.4923,
        west: 5.9560
    };
    
    return (
        lat >= bounds.south && lat <= bounds.north &&
        lng >= bounds.west && lng <= bounds.east
    );
}

module.exports = {
    calculateDistance,
    isValidCoordinate,
    isInSwitzerland
};

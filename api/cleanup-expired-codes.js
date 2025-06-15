const database = require('./utils/database');

// This function runs on a timer trigger (e.g., daily)
module.exports = async function (context, myTimer) {
    try {
        console.log('UeH Garage: Starting scheduled cleanup of expired codes');
        
        const removedCount = await database.cleanupExpiredCodes();
        
        console.log(`UeH Garage: Scheduled cleanup completed. Removed ${removedCount} expired codes`);
        
        context.res = {
            status: 200,
            body: {
                success: true,
                removedCount: removedCount,
                timestamp: new Date().toISOString()
            }
        };
        
    } catch (error) {
        console.error('UeH Garage: Scheduled cleanup failed:', error);
        
        context.res = {
            status: 500,
            body: {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
};

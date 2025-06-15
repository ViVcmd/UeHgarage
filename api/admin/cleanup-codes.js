const database = require('./utils/database');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Check if admin
        const userEmail = event.headers['x-user-email'];
        const adminEmail = process.env.ADMIN_EMAIL;
        
        if (userEmail !== adminEmail) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Admin access required' })
            };
        }

        const removedCount = await database.cleanupExpiredCodes();

        console.log(`UeH Garage: ${removedCount} expired codes cleaned up by admin ${userEmail}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Cleaned up ${removedCount} expired codes`,
                removedCount: removedCount
            })
        };

    } catch (error) {
        console.error('Code cleanup error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

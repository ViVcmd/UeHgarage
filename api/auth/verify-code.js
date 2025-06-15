const database = require('./utils/database');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { email, code } = JSON.parse(event.body);
        
        if (!email || !code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Email and code are required' })
            };
        }

        // Check if user is authorized
        const isWhitelisted = await database.isWhitelisted(email);
        const isBlacklisted = await database.isBlacklisted(email);
        
        if (!isWhitelisted || isBlacklisted) {
            const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'];
            await database.logActivity('Unauthorized code verification attempt', email, email, ipAddress);
            
            return {
                statusCode: 403,
                body: JSON.stringify({
                    success: false,
                    message: 'User not authorized'
                })
            };
        }

        // Validate and use the code
        try {
            await database.validateAndUseCode(email, code);
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: 'Access code verified successfully'
                })
            };
        } catch (error) {
            const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'];
            await database.logActivity('Failed code verification', `${email}: ${error.message}`, email, ipAddress);
            
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid or expired access code'
                })
            };
        }

    } catch (error) {
        console.error('Code verification error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

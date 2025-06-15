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

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminCode = process.env.ADMIN_CODE;
        
        const ipAddress = event.headers['x-forwarded-for'] || event.headers['x-real-ip'];
        const userAgent = event.headers['user-agent'];
        
        if (email === adminEmail && code === adminCode) {
            await database.logActivity('Admin login successful', email, email, ipAddress, userAgent);
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: 'Admin login successful'
                })
            };
        } else {
            await database.logActivity('Admin login failed', email, email, ipAddress, userAgent);
            
            return {
                statusCode: 401,
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid admin credentials'
                })
            };
        }

    } catch (error) {
        console.error('Admin login error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

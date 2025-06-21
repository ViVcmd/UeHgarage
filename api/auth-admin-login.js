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

        // Direct environment variable check - no auth helper needed
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminCode = process.env.ADMIN_CODE;
        
        if (email === adminEmail && code === adminCode) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: 'Admin login successful'
                })
            };
        } else {
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

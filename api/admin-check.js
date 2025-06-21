
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { email } = JSON.parse(event.body);
        
        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Email is required' })
            };
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                isAdmin: email === adminEmail
            })
        };

    } catch (error) {
        console.error('Admin check error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

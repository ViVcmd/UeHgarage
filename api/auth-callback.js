const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { code, state } = event.queryStringParameters;
        
        if (!code) {
            return {
                statusCode: 400,
                headers: {
                    'Location': '/index.html?error=no_code'
                },
                body: ''
            };
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.GOOGLE_REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            throw new Error('Failed to get access token');
        }

        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        const userData = await userResponse.json();

        if (!userData.email) {
            throw new Error('Failed to get user email');
        }

        // Create JWT token
        const jwtToken = jwt.sign(
            { 
                email: userData.email,
                name: userData.name,
                picture: userData.picture
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Redirect to success page with token
        return {
            statusCode: 302,
            headers: {
                'Location': `/auth/success.html?token=${jwtToken}&email=${encodeURIComponent(userData.email)}`
            },
            body: ''
        };

    } catch (error) {
        console.error('OAuth callback error:', error);
        return {
            statusCode: 302,
            headers: {
                'Location': '/index.html?error=oauth_failed'
            },
            body: ''
        };
    }
};

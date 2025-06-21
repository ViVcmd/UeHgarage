exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const state = Math.random().toString(36).substring(2, 15);
        
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', 'openid email profile');
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('access_type', 'offline');

        return {
            statusCode: 302,
            headers: {
                'Location': authUrl.toString()
            },
            body: ''
        };

    } catch (error) {
        console.error('OAuth initiation error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

const database = require('../utils/database');

module.exports = async function (context, req) {
    try {
        const { email } = req.body;
        
        if (!email) {
            context.res = {
                status: 400,
                body: { error: 'Email is required' }
            };
            return;
        }

        const isWhitelisted = await database.isWhitelisted(email);
        const isBlacklisted = await database.isBlacklisted(email);

        context.res = {
            status: 200,
            body: {
                whitelisted: isWhitelisted && !isBlacklisted
            }
        };

    } catch (error) {
        console.error('Whitelist check error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error: ' + error.message }
        };
    }
};

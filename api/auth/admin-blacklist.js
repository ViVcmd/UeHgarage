const database = require('./utils/database');

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

exports.handler = async (event, context) => {
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

        if (event.httpMethod === 'GET') {
            const blacklisted = await database.getBlacklist();
            return {
                statusCode: 200,
                body: JSON.stringify({ blacklisted })
            };
        }

        if (event.httpMethod === 'POST') {
            const { email } = JSON.parse(event.body);
            
            if (!email) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Email is required' })
                };
            }

            if (!isValidEmail(email)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid email format' })
                };
            }

            // Prevent admin from blacklisting themselves
            if (email === userEmail) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: 'Cannot blacklist your own admin account' })
                };
            }

            const added = await database.addToBlacklist(email);
            
            if (added) {
                console.log(`UeH Garage: User ${email} blacklisted by admin ${userEmail}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        message: `User ${email} blacklisted successfully`
                    })
                };
            } else {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: 'User already blacklisted' })
                };
            }
        }

        if (event.httpMethod === 'DELETE') {
            const { email } = JSON.parse(event.body);
            
            if (!email) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Email is required' })
                };
            }

            if (!isValidEmail(email)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid email format' })
                };
            }

            const removed = await database.removeFromBlacklist(email);
            
            if (removed) {
                console.log(`UeH Garage: User ${email} removed from blacklist by admin ${userEmail}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        success: true,
                        message: `User ${email} removed from blacklist successfully`
                    })
                };
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'User not found in blacklist' })
                };
            }
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Blacklist management error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

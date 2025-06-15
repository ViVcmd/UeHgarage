
const database = require('./utils/database');

function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    // Generate 3 groups of 4 characters each
    for (let group = 0; group < 3; group++) {
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (group < 2) {
            result += '-';
        }
    }
    
    return result; // Format: XXXX-XXXX-XXXX
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

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

        const { email, expiresInHours = 24 } = JSON.parse(event.body);
        
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

        // Validate expiration hours
        if (typeof expiresInHours !== 'number' || expiresInHours < 1 || expiresInHours > 168) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'expiresInHours must be between 1 and 168 (1 week)' })
            };
        }

        // Check if user is whitelisted
        const isWhitelisted = await database.isWhitelisted(email);
        if (!isWhitelisted) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'User is not whitelisted' })
            };
        }

        // Check if user already has an active code
        const hasActiveCode = await database.hasActiveCode(email);
        if (hasActiveCode) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: 'User already has an active access code' })
            };
        }

        const code = generateAccessCode();
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        
        await database.setCode(email, code, expiresAt);
        
        console.log(`UeH Garage: Access code generated for ${email} by admin ${userEmail}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Access code generated for ${email}`,
                code: code,
                expiresAt: expiresAt.toISOString(),
                expiresInHours: expiresInHours
            })
        };

    } catch (error) {
        console.error('Code generation error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

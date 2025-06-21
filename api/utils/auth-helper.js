const jwt = require('jsonwebtoken');
const database = require('./database');

class AuthHelper {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.adminEmail = process.env.ADMIN_EMAIL;
    }

    // Get user from Netlify (simplified - you'll need to implement based on your auth method)
    getUserFromRequest(event) {
        try {
            // For Netlify, you'll get user email from headers you set
            const userEmail = event.headers['x-user-email'];
            if (!userEmail) {
                return null;
            }

            return {
                email: userEmail,
                provider: 'netlify',
                userId: userEmail
            };
        } catch (error) {
            console.error('Error parsing user from request:', error);
            return null;
        }
    }

    // Check if user is authenticated
    isAuthenticated(event) {
        return this.getUserFromRequest(event) !== null;
    }

    // Check if user is admin
    isAdmin(event) {
        const user = this.getUserFromRequest(event);
        return user && user.email === this.adminEmail;
    }

    // Check if user is authorized (whitelisted and not blacklisted)
    async isAuthorized(event) {
        const user = this.getUserFromRequest(event);
        if (!user) {
            return false;
        }

        try {
            const isWhitelisted = await database.isWhitelisted(user.email);
            const isBlacklisted = await database.isBlacklisted(user.email);
            
            return isWhitelisted && !isBlacklisted;
        } catch (error) {
            console.error('Error checking user authorization:', error);
            return false;
        }
    }

    // Generate JWT token for custom authentication
    generateToken(payload, expiresIn = '24h') {
        try {
            return jwt.sign(payload, this.jwtSecret, { expiresIn });
        } catch (error) {
            console.error('Error generating JWT token:', error);
            throw new Error('Token generation failed');
        }
    }

    // Verify JWT token
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            console.error('Error verifying JWT token:', error);
            return null;
        }
    }

    // Create authentication response
    createAuthResponse(success, message = '', data = {}) {
        return {
            success,
            message,
            timestamp: new Date().toISOString(),
            ...data
        };
    }

    // Create error response
    createErrorResponse(message, statusCode = 400) {
        return {
            statusCode,
            body: JSON.stringify({
                error: message,
                timestamp: new Date().toISOString()
            })
        };
    }

    // Create success response
    createSuccessResponse(data = {}, statusCode = 200) {
        return {
            statusCode,
            body: JSON.stringify({
                success: true,
                timestamp: new Date().toISOString(),
                ...data
            })
        };
    }

    // Rate limiting helper (simplified for Netlify)
    async checkRateLimit(identifier, maxAttempts = 5, windowMinutes = 15) {
        // Simple in-memory rate limiting (in production, use external storage)
        if (!this.rateLimitStore) {
            this.rateLimitStore = new Map();
        }

        const key = `rate_limit_${identifier}`;
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;

        const attempts = this.rateLimitStore.get(key) || [];
        const validAttempts = attempts.filter(time => now - time < windowMs);

        if (validAttempts.length >= maxAttempts) {
            return {
                allowed: false,
                remainingAttempts: 0,
                resetTime: new Date(validAttempts[0] + windowMs)
            };
        }

        validAttempts.push(now);
        this.rateLimitStore.set(key, validAttempts);

        return {
            allowed: true,
            remainingAttempts: maxAttempts - validAttempts.length,
            resetTime: null
        };
    }

    // Log security event
    async logSecurityEvent(event, details, userEmail = null, ipAddress = null) {
        try {
            await database.logActivity(
                `Security: ${event}`,
                JSON.stringify({ ...details, ip: ipAddress }),
                userEmail || 'anonymous'
            );
        } catch (error) {
            console.error('Error logging security event:', error);
        }
    }

    // Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Sanitize input
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }
        
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .substring(0, 1000); // Limit length
    }
}

module.exports = new AuthHelper();

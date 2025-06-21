const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

class UeHGarageDatabase {
    // User management
    async getUsers() {
        try {
            const users = await sql`
                SELECT email, is_active, is_blacklisted, created_at,
                       EXISTS(
                           SELECT 1 FROM access_codes 
                           WHERE email = users.email 
                           AND is_used = false 
                           AND expires_at > NOW()
                       ) as has_active_code
                FROM users 
                WHERE is_active = true 
                ORDER BY created_at DESC
            `;
            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    async addUser(email) {
        try {
            await sql`
                INSERT INTO users (email, is_active) 
                VALUES (${email}, true)
                ON CONFLICT (email) DO UPDATE SET 
                    is_active = true,
                    is_blacklisted = false,
                    updated_at = CURRENT_TIMESTAMP
            `;
            await this.logActivity('User added', email, 'system');
            return true;
        } catch (error) {
            console.error('Error adding user:', error);
            return false;
        }
    }

    async removeUser(email) {
        try {
            await sql`
                UPDATE users 
                SET is_active = false, updated_at = CURRENT_TIMESTAMP 
                WHERE email = ${email}
            `;
            await this.logActivity('User removed', email, 'system');
            return true;
        } catch (error) {
            console.error('Error removing user:', error);
            return false;
        }
    }

    async isWhitelisted(email) {
        try {
            const result = await sql`
                SELECT 1 FROM users 
                WHERE email = ${email} 
                AND is_active = true 
                AND is_blacklisted = false
            `;
            return result.length > 0;
        } catch (error) {
            console.error('Error checking whitelist:', error);
            return false;
        }
    }

    async isBlacklisted(email) {
        try {
            const result = await sql`
                SELECT 1 FROM users 
                WHERE email = ${email} 
                AND is_blacklisted = true
            `;
            return result.length > 0;
        } catch (error) {
            console.error('Error checking blacklist:', error);
            return false;
        }
    }

    async addToBlacklist(email) {
        try {
            await sql`
                UPDATE users 
                SET is_blacklisted = true, updated_at = CURRENT_TIMESTAMP 
                WHERE email = ${email}
            `;
            await this.logActivity('User blacklisted', email, 'system');
            return true;
        } catch (error) {
            console.error('Error blacklisting user:', error);
            return false;
        }
    }

    async removeFromBlacklist(email) {
        try {
            await sql`
                UPDATE users 
                SET is_blacklisted = false, updated_at = CURRENT_TIMESTAMP 
                WHERE email = ${email}
            `;
            await this.logActivity('User removed from blacklist', email, 'system');
            return true;
        } catch (error) {
            console.error('Error removing from blacklist:', error);
            return false;
        }
    }

    async getBlacklist() {
        try {
            const result = await sql`
                SELECT email FROM users 
                WHERE is_blacklisted = true 
                ORDER BY updated_at DESC
            `;
            return result.map(row => row.email);
        } catch (error) {
            console.error('Error getting blacklist:', error);
            return [];
        }
    }

    // Access code management
    async setCode(email, code, expiresAt = null) {
        try {
            const expiration = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            await sql`
                INSERT INTO access_codes (email, code, expires_at) 
                VALUES (${email}, ${code}, ${expiration})
            `;
            await this.logActivity('Access code generated', email, 'system');
            return true;
        } catch (error) {
            console.error('Error setting code:', error);
            throw error;
        }
    }

    async validateAndUseCode(email, code) {
        try {
            const result = await sql`
                UPDATE access_codes 
                SET is_used = true, used_at = CURRENT_TIMESTAMP 
                WHERE email = ${email} 
                AND code = ${code} 
                AND is_used = false 
                AND expires_at > CURRENT_TIMESTAMP
                RETURNING id
            `;
            
            if (result.length === 0) {
                throw new Error('Invalid or expired code');
            }
            
            await this.logActivity('Access code used', email, email);
            return true;
        } catch (error) {
            console.error('Error validating code:', error);
            throw error;
        }
    }

    async hasActiveCode(email) {
        try {
            const result = await sql`
                SELECT 1 FROM access_codes 
                WHERE email = ${email} 
                AND is_used = false 
                AND expires_at > CURRENT_TIMESTAMP
            `;
            return result.length > 0;
        } catch (error) {
            console.error('Error checking active code:', error);
            return false;
        }
    }

    async getCodeStats() {
        try {
            const result = await sql`
                SELECT 
                    COUNT(*) FILTER (WHERE is_used = false AND expires_at > CURRENT_TIMESTAMP) as active_codes,
                    COUNT(*) FILTER (WHERE is_used = true OR expires_at <= CURRENT_TIMESTAMP) as expired_codes
                FROM access_codes
            `;
            return {
                activeCodes: parseInt(result[0].active_codes),
                expiredCodes: parseInt(result[0].expired_codes)
            };
        } catch (error) {
            console.error('Error getting code stats:', error);
            return { activeCodes: 0, expiredCodes: 0 };
        }
    }

    async cleanupExpiredCodes() {
        try {
            const result = await sql`
                DELETE FROM access_codes 
                WHERE (is_used = true OR expires_at <= CURRENT_TIMESTAMP) 
                AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
                RETURNING id
            `;
            
            const removedCount = result.length;
            await this.logActivity('Expired codes cleaned up', `${removedCount} codes`, 'system');
            return removedCount;
        } catch (error) {
            console.error('Error cleaning up codes:', error);
            return 0;
        }
    }

    // Settings management
    async getSettings() {
        try {
            const result = await sql`
                SELECT key, value FROM settings
            `;
            const settings = {};
            result.forEach(row => {
                settings[row.key] = row.value === 'true' ? true : 
                                   row.value === 'false' ? false : 
                                   isNaN(row.value) ? row.value : Number(row.value);
            });
            return settings;
        } catch (error) {
            console.error('Error getting settings:', error);
            return { maintenance_mode: false };
        }
    }

    async updateSettings(settings) {
        try {
            for (const [key, value] of Object.entries(settings)) {
                await sql`
                    INSERT INTO settings (key, value, updated_at) 
                    VALUES (${key}, ${value.toString()}, CURRENT_TIMESTAMP)
                    ON CONFLICT (key) DO UPDATE SET 
                        value = EXCLUDED.value,
                        updated_at = EXCLUDED.updated_at
                `;
            }
            await this.logActivity('Settings updated', JSON.stringify(settings), 'system');
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }

    // Activity logging
    async logActivity(action, target, userEmail, ipAddress = null, userAgent = null) {
        try {
            await sql`
                INSERT INTO activity_log (user_email, action, target, ip_address, user_agent) 
                VALUES (${userEmail}, ${action}, ${target}, ${ipAddress}, ${userAgent})
            `;
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    async getActivityLog(limit = 50) {
        try {
            const result = await sql`
                SELECT user_email, action, target, ip_address, created_at 
                FROM activity_log 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                ORDER BY created_at DESC 
                LIMIT ${limit}
            `;
            return result;
        } catch (error) {
            console.error('Error getting activity log:', error);
            return [];
        }
    }

    async getActiveUsers() {
        try {
            const result = await sql`
                SELECT COUNT(DISTINCT user_email) as count 
                FROM activity_log 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
                AND user_email IS NOT NULL 
                AND user_email != 'system'
            `;
            return { count: parseInt(result[0].count) };
        } catch (error) {
            console.error('Error getting active users:', error);
            return { count: 0 };
        }
    }
}

module.exports = new UeHGarageDatabase();

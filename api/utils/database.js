const { TableClient } = require("@azure/data-tables");
const { CosmosClient } = require("@azure/cosmos");

class UeHGarageDatabase {
    constructor() {
        // Initialize Azure Table Storage
        this.usersTable = new TableClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "UeHGarageUsers"
        );
        this.codesTable = new TableClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "UeHGarageAccessCodes"
        );
        this.blacklistTable = new TableClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "UeHGarageBlacklist"
        );
        this.settingsTable = new TableClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "UeHGarageSettings"
        );
        this.activityTable = new TableClient(
            process.env.AZURE_STORAGE_CONNECTION_STRING,
            "UeHGarageActivity"
        );

        this.initializeTables();
    }

    async initializeTables() {
        try {
            await Promise.all([
                this.usersTable.createTable(),
                this.codesTable.createTable(),
                this.blacklistTable.createTable(),
                this.settingsTable.createTable(),
                this.activityTable.createTable()
            ]);
        } catch (error) {
            // Tables might already exist, which is fine
            console.log('Tables initialization completed');
        }
    }

    // User management
    async getUsers() {
        try {
            const entities = this.usersTable.listEntities();
            const users = [];
            
            for await (const entity of entities) {
                users.push({
                    email: entity.rowKey,
                    addedAt: entity.addedAt,
                    hasActiveCode: await this.hasActiveCode(entity.rowKey)
                });
            }
            
            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    async addUser(email) {
        try {
            const entity = {
                partitionKey: "users",
                rowKey: email,
                addedAt: new Date().toISOString(),
                isActive: true
            };
            
            await this.usersTable.createEntity(entity);
            await this.logActivity('User added', email, 'system');
            return true;
        } catch (error) {
            if (error.statusCode === 409) {
                return false; // User already exists
            }
            throw error;
        }
    }

    async removeUser(email) {
        try {
            await this.usersTable.deleteEntity("users", email);
            await this.removeUserCodes(email);
            await this.logActivity('User removed', email, 'system');
            return true;
        } catch (error) {
            if (error.statusCode === 404) {
                return false; // User not found
            }
            throw error;
        }
    }

    async isWhitelisted(email) {
        try {
            await this.usersTable.getEntity("users", email);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Blacklist management
    async isBlacklisted(email) {
        try {
            await this.blacklistTable.getEntity("blacklist", email);
            return true;
        } catch (error) {
            return false;
        }
    }

    async addToBlacklist(email) {
        try {
            const entity = {
                partitionKey: "blacklist",
                rowKey: email,
                blacklistedAt: new Date().toISOString(),
                reason: "Admin action"
            };
            
            await this.blacklistTable.createEntity(entity);
            await this.logActivity('User blacklisted', email, 'system');
            return true;
        } catch (error) {
            if (error.statusCode === 409) {
                return false; // Already blacklisted
            }
            throw error;
        }
    }

    async removeFromBlacklist(email) {
        try {
            await this.blacklistTable.deleteEntity("blacklist", email);
            await this.logActivity('User removed from blacklist', email, 'system');
            return true;
        } catch (error) {
            if (error.statusCode === 404) {
                return false; // Not in blacklist
            }
            throw error;
        }
    }

    async getBlacklist() {
        try {
            const entities = this.blacklistTable.listEntities();
            const blacklisted = [];
            
            for await (const entity of entities) {
                blacklisted.push(entity.rowKey);
            }
            
            return blacklisted;
        } catch (error) {
            console.error('Error getting blacklist:', error);
            return [];
        }
    }

    // Access code management
    async setCode(email, code, expiresAt = null) {
        try {
            // Default expiration: 24 hours
            const expiration = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            const entity = {
                partitionKey: email,
                rowKey: code,
                createdAt: new Date().toISOString(),
                expiresAt: expiration.toISOString(),
                isUsed: false,
                usedAt: null
            };
            
            await this.codesTable.createEntity(entity);
            await this.logActivity('Access code generated', email, 'system');
            return true;
        } catch (error) {
            console.error('Error setting code:', error);
            throw error;
        }
    }

    async getCode(email) {
        try {
            const entities = this.codesTable.listEntities({
                queryOptions: { 
                    filter: `PartitionKey eq '${email}' and isUsed eq false and expiresAt gt datetime'${new Date().toISOString()}'` 
                }
            });
            
            for await (const entity of entities) {
                return entity.rowKey; // Return the first valid code
            }
            
            return null;
        } catch (error) {
            console.error('Error getting code:', error);
            return null;
        }
    }

    async validateAndUseCode(email, code) {
        try {
            const entity = await this.codesTable.getEntity(email, code);
            
            // Check if code is valid
            if (entity.isUsed) {
                throw new Error('Code already used');
            }
            
            if (new Date(entity.expiresAt) < new Date()) {
                throw new Error('Code expired');
            }
            
            // Mark code as used
            entity.isUsed = true;
            entity.usedAt = new Date().toISOString();
            
            await this.codesTable.updateEntity(entity, "Replace");
            await this.logActivity('Access code used', email, email);
            
            return true;
        } catch (error) {
            console.error('Error validating code:', error);
            throw error;
        }
    }

    async removeUserCodes(email) {
        try {
            const entities = this.codesTable.listEntities({
                queryOptions: { filter: `PartitionKey eq '${email}'` }
            });
            
            for await (const entity of entities) {
                await this.codesTable.deleteEntity(entity.partitionKey, entity.rowKey);
            }
        } catch (error) {
            console.error('Error removing user codes:', error);
        }
    }

    async hasActiveCode(email) {
        try {
            const entities = this.codesTable.listEntities({
                queryOptions: { 
                    filter: `PartitionKey eq '${email}' and isUsed eq false and expiresAt gt datetime'${new Date().toISOString()}'` 
                }
            });
            
            for await (const entity of entities) {
                return true; // Has at least one active code
            }
            
            return false;
        } catch (error) {
            console.error('Error checking active code:', error);
            return false;
        }
    }

    async getCodeStats() {
        try {
            const now = new Date().toISOString();
            const allEntities = this.codesTable.listEntities();
            
            let activeCodes = 0;
            let expiredCodes = 0;
            
            for await (const entity of allEntities) {
                if (!entity.isUsed && entity.expiresAt > now) {
                    activeCodes++;
                } else {
                    expiredCodes++;
                }
            }
            
            return { activeCodes, expiredCodes };
        } catch (error) {
            console.error('Error getting code stats:', error);
            return { activeCodes: 0, expiredCodes: 0 };
        }
    }

    async cleanupExpiredCodes() {
        try {
            const now = new Date().toISOString();
            const entities = this.codesTable.listEntities({
                queryOptions: { 
                    filter: `expiresAt lt datetime'${now}' or isUsed eq true` 
                }
            });
            
            let removedCount = 0;
            
            for await (const entity of entities) {
                // Only remove codes older than 7 days to keep some history
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                if (entity.createdAt < sevenDaysAgo) {
                    await this.codesTable.deleteEntity(entity.partitionKey, entity.rowKey);
                    removedCount++;
                }
            }
            
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
            const entity = await this.settingsTable.getEntity("settings", "main");
            return {
                maintenanceMode: entity.maintenanceMode || false,
                lastUpdated: entity.lastUpdated
            };
        } catch (error) {
            // Return default settings if not found
            return { maintenanceMode: false };
        }
    }

    async updateSettings(settings) {
        try {
            const entity = {
                partitionKey: "settings",
                rowKey: "main",
                maintenanceMode: settings.maintenanceMode || false,
                lastUpdated: new Date().toISOString()
            };
            
            await this.settingsTable.upsertEntity(entity, "Replace");
            await this.logActivity('Settings updated', JSON.stringify(settings), 'system');
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }

    // Activity logging
    async logActivity(action, target, user) {
        try {
            const entity = {
                partitionKey: new Date().toISOString().split('T')[0], // Date as partition
                rowKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                action: action,
                target: target,
                user: user,
                ip: null // Can be added later
            };
            
            await this.activityTable.createEntity(entity);
        } catch (error) {
            console.error('Error logging activity:', error);
            // Don't throw - logging failures shouldn't break main functionality
        }
    }

    async getActivityLog(limit = 50) {
        try {
            const entities = this.activityTable.listEntities({
                queryOptions: { 
                    select: ["timestamp", "action", "target", "user"],
                    filter: `timestamp gt datetime'${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}'`
                }
            });
            
            const activities = [];
            let count = 0;
            
            for await (const entity of entities) {
                if (count >= limit) break;
                
                activities.push({
                    timestamp: entity.timestamp,
                    action: entity.action,
                    target: entity.target,
                    user: entity.user
                });
                count++;
            }
            
            // Sort by timestamp descending
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return activities;
        } catch (error) {
            console.error('Error getting activity log:', error);
            return [];
        }
    }
}

// Export singleton instance
module.exports = new UeHGarageDatabase();

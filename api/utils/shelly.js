const axios = require('axios');

class UeHGarageShellyController {
    constructor() {
        this.deviceId = process.env.SHELLY_DEVICE_ID;
        this.authKey = process.env.SHELLY_AUTH_KEY;
        this.baseUrl = 'https://shelly-165-eu.shelly.cloud';
        this.timeout = 15000; // 15 seconds timeout
        this.retryAttempts = 3;
        this.retryDelay = 2000; // 2 seconds between retries
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            url: `${this.baseUrl}${endpoint}`,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'UeH-Garage-System/1.0'
            }
        };

        if (method === 'POST' && data) {
            config.data = data;
        } else if (method === 'GET' && data) {
            config.params = data;
        }

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`UeH Garage: Shelly API call attempt ${attempt}/${this.retryAttempts}`);
                const response = await axios(config);
                
                console.log('UeH Garage: Shelly API call successful');
                return {
                    success: true,
                    data: response.data,
                    status: response.status
                };
            } catch (error) {
                console.error(`UeH Garage: Shelly API attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.retryAttempts) {
                    return {
                        success: false,
                        error: error.message,
                        code: error.code,
                        status: error.response?.status
                    };
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
    }

    async sendCommand(command) {
        console.log(`UeH Garage: Sending command '${command}' to Shelly device ${this.deviceId}`);
        
        if (!this.deviceId || !this.authKey) {
            return {
                success: false,
                error: 'Shelly device ID or auth key not configured'
            };
        }

        const commandData = {
            id: this.deviceId,
            auth_key: this.authKey,
            turn: command
        };

        const result = await this.makeRequest('/device/relay/control', 'POST', commandData);
        
        if (result.success) {
            console.log(`UeH Garage: Command '${command}' sent successfully`);
        } else {
            console.error(`UeH Garage: Command '${command}' failed:`, result.error);
        }

        return result;
    }

    async getStatus() {
        console.log(`UeH Garage: Getting status for Shelly device ${this.deviceId}`);
        
        if (!this.deviceId || !this.authKey) {
            return {
                success: false,
                error: 'Shelly device ID or auth key not configured'
            };
        }

        const statusData = {
            id: this.deviceId,
            auth_key: this.authKey
        };

        const result = await this.makeRequest('/device/status', 'GET', statusData);
        
        if (result.success) {
            console.log('UeH Garage: Status retrieved successfully');
            
            // Parse the status to determine garage state
            const relays = result.data.data?.device_status?.relays || [];
            const isOpen = relays.length > 0 ? relays[0].ison : false;
            
            return {
                success: true,
                data: result.data,
                isOpen: isOpen,
                status: isOpen ? 'Open' : 'Closed',
                lastUpdate: new Date().toISOString()
            };
        } else {
            console.error('UeH Garage: Status check failed:', result.error);
            return result;
        }
    }

    async openGarage() {
        console.log('UeH Garage: Opening garage door');
        
        // First check current status
        const statusResult = await this.getStatus();
        if (statusResult.success && statusResult.isOpen) {
            console.log('UeH Garage: Garage is already open');
            return {
                success: true,
                message: 'Garage is already open',
                alreadyOpen: true
            };
        }

        // Send open command
        const result = await this.sendCommand('on');
        
        if (result.success) {
            // Wait a moment and verify the command worked
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const verifyResult = await this.getStatus();
            if (verifyResult.success) {
                return {
                    success: true,
                    message: 'Garage opened successfully',
                    verified: verifyResult.isOpen,
                    status: verifyResult.status
                };
            }
        }

        return result;
    }

    async closeGarage() {
        console.log('UeH Garage: Closing garage door');
        
        // First check current status
        const statusResult = await this.getStatus();
        if (statusResult.success && !statusResult.isOpen) {
            console.log('UeH Garage: Garage is already closed');
            return {
                success: true,
                message: 'Garage is already closed',
                alreadyClosed: true
            };
        }

        // Send close command
        const result = await this.sendCommand('off');
        
        if (result.success) {
            // Wait a moment and verify the command worked
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const verifyResult = await this.getStatus();
            if (verifyResult.success) {
                return {
                    success: true,
                    message: 'Garage closed successfully',
                    verified: !verifyResult.isOpen,
                    status: verifyResult.status
                };
            }
        }

        return result;
    }

    async toggleGarage() {
        console.log('UeH Garage: Toggling garage door');
        
        const statusResult = await this.getStatus();
        if (!statusResult.success) {
            return statusResult;
        }

        if (statusResult.isOpen) {
            return await this.closeGarage();
        } else {
            return await this.openGarage();
        }
    }

    // Health check for the Shelly device
    async healthCheck() {
        console.log('UeH Garage: Performing Shelly device health check');
        
        const startTime = Date.now();
        const result = await this.getStatus();
        const responseTime = Date.now() - startTime;
        
        return {
            success: result.success,
            responseTime: responseTime,
            status: result.success ? 'healthy' : 'unhealthy',
            error: result.error || null,
            lastChecked: new Date().toISOString()
        };
    }
}

module.exports = UeHGarageShellyController;

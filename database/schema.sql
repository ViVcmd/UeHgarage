-- Users table for whitelist/blacklist management
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_blacklisted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Access codes table with expiration
CREATE TABLE access_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(14) NOT NULL, -- XXXX-XXXX-XXXX format
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

-- Activity log for audit trail
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    target VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings
CREATE TABLE settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user
INSERT INTO users (email, is_active) VALUES ('your_admin@example.com', true);

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
    ('maintenance_mode', 'false'),
    ('max_distance_meters', '1000'),
    ('code_expiry_hours', '24');

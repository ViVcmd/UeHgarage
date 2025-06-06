# Environment Variables Configuration

## Complete List of Required Environment Variables

### Backend Environment Variables (.env file or Netlify environment)

```bash
# Database Configuration
MONGO_URL="mongodb://localhost:27017"
DB_NAME="garage_control"

# Security Keys
SECRET_KEY="your-secret-key-for-jwt-sessions"

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# Shelly Device Configuration
SHELLY_DEVICE_ID="your-shelly-device-id"
SHELLY_API_KEY="your-shelly-api-key"

# Admin Configuration
ADMIN_CODE="ADMIN-12345-ABCDE-67890-FGHIJ"
```

### Frontend Environment Variables (.env file)

```bash
# Backend URL (already configured)
REACT_APP_BACKEND_URL="https://your-backend-url.com"
```

## Detailed Variable Descriptions

### 1. MONGO_URL
- **Purpose**: MongoDB connection string
- **Example**: `"mongodb://localhost:27017"` or `"mongodb://username:password@host:port/database"`
- **Default**: Uses local MongoDB

### 2. DB_NAME
- **Purpose**: MongoDB database name
- **Example**: `"garage_control"`
- **Default**: Will create if doesn't exist

### 3. SECRET_KEY
- **Purpose**: JWT token signing and session encryption
- **Security**: Use a strong, random 32+ character string
- **Example**: Generate with: `openssl rand -base64 32`

### 4. GOOGLE_CLIENT_ID
- **Purpose**: Google OAuth2 client identifier
- **Where to get**: Google Cloud Console → APIs & Services → Credentials
- **Format**: Ends with `.apps.googleusercontent.com`

### 5. GOOGLE_CLIENT_SECRET
- **Purpose**: Google OAuth2 client secret
- **Where to get**: Google Cloud Console → Same location as Client ID
- **Security**: Keep this secret and secure

### 6. SHELLY_DEVICE_ID
- **Purpose**: Your Shelly 1 Mini Gen 3 device identifier
- **Where to find**: Shelly app or device settings
- **Format**: Usually alphanumeric string

### 7. SHELLY_API_KEY
- **Purpose**: API key for Shelly cloud service
- **Where to get**: Shelly app → Settings → Cloud → API Key
- **Security**: Keep this secret

### 8. ADMIN_CODE (Optional)
- **Purpose**: Special code to create admin users
- **Format**: 25-30 characters with hyphens (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX)
- **Default**: `"ADMIN-12345-ABCDE-67890-FGHIJ"`
- **Security**: Change this immediately

## How to Set Environment Variables in Netlify

1. **Go to Netlify Dashboard**
2. **Select your site**
3. **Go to Site settings → Environment variables**
4. **Add each variable:**
   - Variable name: `SECRET_KEY`
   - Value: `your-actual-secret-key`
   - Click "Create variable"

## Security Best Practices

### ✅ DO:
- Use strong, unique values for SECRET_KEY
- Change the default ADMIN_CODE immediately
- Keep API keys secure and never commit them to code
- Regularly rotate sensitive keys

### ❌ DON'T:
- Use default/weak values in production
- Share API keys or secrets
- Commit .env files to version control
- Use the same keys across environments

## Getting Your Credentials

### Google OAuth2 Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add your domains:
   - JavaScript origins: `https://uehgarage.netlify.app`
   - Redirect URIs: `https://uehgarage.netlify.app/auth/google/callback`

### Shelly Device Setup:
1. Open Shelly app
2. Go to your device settings
3. Enable Cloud connection
4. Get Device ID from device info
5. Generate API key in Cloud settings

## Testing Configuration

After setting all variables, test your setup:

1. **Backend health check**: `GET /api/health`
2. **Google OAuth**: Try signing in
3. **Admin access**: Use admin code
4. **Garage control**: Test device integration

## Troubleshooting

### Common Issues:
- **OAuth fails**: Check redirect URLs match exactly
- **Device control fails**: Verify Shelly device ID and API key
- **Admin code doesn't work**: Ensure ADMIN_CODE is set correctly
- **JWT errors**: Check SECRET_KEY is set and consistent

### Log Locations:
- Backend logs: `/var/log/supervisor/backend.*.log`
- Check admin dashboard audit logs for detailed error tracking
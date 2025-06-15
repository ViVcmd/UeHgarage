// <Project overview and instructions>
# UeH Garage - Production-Ready Secure Access Control System

A comprehensive, production-ready web application for controlling UeH Garage via Shelly device with Azure authentication, geolocation verification, and advanced security features.

## 🚀 Features

### Core Functionality
- **Azure Static Web Apps Authentication** - Secure sign-in with Google OAuth2
- **Email Whitelisting & Blacklisting** - Granular user access control
- **One-Time Access Codes** - 12-character codes in XXXX-XXXX-XXXX format with expiration
- **Geolocation Security** - Distance-based access control with Switzerland region validation
- **Shelly Device Integration** - Direct control of Shelly 1 Mini Gen 3 via cloud API
- **Real-time Status Updates** - Live garage door status monitoring

### Security Features
- **Multi-Factor Authentication** - Azure OAuth2 + one-time codes
- **Rate Limiting** - Protection against brute force attacks
- **Geofencing** - Location-based access restrictions
- **Activity Logging** - Comprehensive audit trail
- **Input Validation** - Sanitization and validation of all inputs
- **HTTPS Enforcement** - End-to-end encryption
- **Content Security Policy** - XSS protection
- **Session Management** - Secure session handling

### Administrative Features
- **Admin Panel** - Comprehensive system management
- **User Management** - Add/remove users, generate codes
- **System Health Monitoring** - Real-time system status
- **Maintenance Mode** - System-wide maintenance control
- **Activity Dashboard** - User activity monitoring
- **Code Management** - Track active/expired codes
- **Blacklist Management** - Security controls

### Production Features
- **Azure Table Storage** - Persistent data storage
- **Error Handling** - Comprehensive error management
- **Retry Logic** - Automatic retry for failed operations
- **Health Checks** - System component monitoring
- **Automated Cleanup** - Expired code removal
- **Responsive Design** - Mobile-friendly interface
- **Accessibility** - WCAG compliance features
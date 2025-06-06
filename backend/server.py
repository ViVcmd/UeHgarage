from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import secrets
import string
import httpx
import jwt
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Add session middleware for OAuth
app.add_middleware(SessionMiddleware, secret_key=os.environ.get('SECRET_KEY', 'fallback-secret-key'))

# OAuth setup
config = Config('.env')
oauth = OAuth(config)
oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Admin configuration
ADMIN_EMAIL = "vinzent.ga@sser.ch"
ADMIN_CODE = os.environ.get('ADMIN_CODE', 'ADMIN-12345-ABCDE-67890-FGHIJ')

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    google_id: str
    is_admin: bool = False
    is_active: bool = True
    is_blacklisted: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)
    invitation_code_used: Optional[str] = None

class InvitationCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    created_by: str  # admin user id
    used_by: Optional[str] = None  # user id who used it
    is_used: bool = False
    is_admin_code: bool = False  # Special admin codes
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used_at: Optional[datetime] = None
    expires_at: datetime

class WhitelistEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    added_by: str  # admin user id
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BlacklistEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    reason: str
    added_by: str  # admin user id
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SystemSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    maintenance_mode: bool = False
    maintenance_message: str = "System under maintenance. Please try again later."
    updated_by: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    action: str  # "login", "garage_open", "admin_action", etc.
    details: dict = {}
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AdminCodeRequest(BaseModel):
    admin_code: str
    email: str

class InvitationRequest(BaseModel):
    invitation_code: str
    email: str

class WhitelistRequest(BaseModel):
    email: str

class BlacklistRequest(BaseModel):
    email: str
    reason: str

# Helper functions
def generate_invitation_code():
    """Generate a 25-30 character invitation code with hyphens every 5 chars"""
    chars = string.ascii_uppercase + string.ascii_lowercase + string.digits + "!@#$%^&*"
    groups = []
    for _ in range(5):
        group = ''.join(secrets.choice(chars) for _ in range(5))
        groups.append(group)
    return '-'.join(groups)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, options={"verify_signature": False})
        user_email = payload.get("email")
        if not user_email:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"email": user_email})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_obj = User(**user)
        
        # Check if user is blacklisted
        if user_obj.is_blacklisted:
            raise HTTPException(status_code=403, detail="Account has been suspended")
        
        # Check maintenance mode (admins bypass)
        if not user_obj.is_admin:
            settings = await get_system_settings()
            if settings and settings.maintenance_mode:
                raise HTTPException(status_code=503, detail=settings.maintenance_message)
        
        return user_obj
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def admin_required(user: User = Depends(get_current_user)):
    """Require admin privileges"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

async def log_action(user_id: str, user_email: str, action: str, details: dict = {}, ip_address: str = None):
    """Log user action"""
    log_entry = AuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        details=details,
        ip_address=ip_address
    )
    await db.audit_logs.insert_one(log_entry.dict())

async def get_system_settings():
    """Get current system settings"""
    settings = await db.system_settings.find_one()
    if settings:
        return SystemSettings(**settings)
    return None

async def is_email_whitelisted(email: str):
    """Check if email is whitelisted"""
    whitelist_entry = await db.whitelist.find_one({"email": email})
    return whitelist_entry is not None

async def is_email_blacklisted(email: str):
    """Check if email is blacklisted"""
    blacklist_entry = await db.blacklist.find_one({"email": email})
    return blacklist_entry is not None

# Auth routes
@api_router.get("/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    redirect_uri = "https://uehgarage.netlify.app/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@api_router.get("/auth/google/callback")
async def google_callback(request: Request):
    """Handle Google OAuth callback - always requires invitation code"""
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info or not user_info.get('email'):
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
        email = user_info.get('email')
        name = user_info.get('name', email)
        google_id = user_info.get('sub')
        
        # Check if email is blacklisted
        if await is_email_blacklisted(email):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check existing user
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            # Update last login
            await db.users.update_one(
                {"email": email},
                {"$set": {"last_login": datetime.utcnow()}}
            )
            user = User(**existing_user)
            
            # Create JWT token
            token_data = {
                "email": user.email,
                "user_id": user.id,
                "exp": datetime.utcnow() + timedelta(hours=24)
            }
            access_token = jwt.encode(token_data, "secret", algorithm="HS256")
            
            await log_action(user.id, user.email, "login", {"email": email})
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "email": user.email,
                    "name": user.name,
                    "is_admin": user.is_admin
                }
            }
        else:
            # New user - must provide invitation code
            return {
                "requires_invitation": True,
                "email": email,
                "name": name,
                "google_id": google_id,
                "message": "Please provide your invitation code to complete registration"
            }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

@api_router.post("/auth/invitation")
async def use_invitation_code(request: InvitationRequest):
    """Use invitation code to register new user"""
    email = request.email
    invitation_code = request.invitation_code
    
    # Check if email is blacklisted
    if await is_email_blacklisted(email):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Check admin code first
    if invitation_code == ADMIN_CODE:
        # Create admin user directly
        user = User(
            email=email,
            name=email.split('@')[0],
            google_id=f"admin_{uuid.uuid4()}",
            is_admin=True,
            invitation_code_used=invitation_code
        )
        await db.users.insert_one(user.dict())
        
        # Log the admin creation
        await log_action(user.id, user.email, "admin_created", {"code_type": "admin_code"})
        
        # Create JWT token
        token_data = {
            "email": user.email,
            "user_id": user.id,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        access_token = jwt.encode(token_data, "secret", algorithm="HS256")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "email": user.email,
                "name": user.name,
                "is_admin": user.is_admin
            },
            "message": "Admin account created successfully"
        }
    
    # Find regular invitation code
    invitation = await db.invitation_codes.find_one({"code": invitation_code})
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    invitation_obj = InvitationCode(**invitation)
    
    if invitation_obj.is_used:
        raise HTTPException(status_code=400, detail="Invitation code already used")
    
    if invitation_obj.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitation code expired")
    
    # Check if email is whitelisted (if not admin)
    if not await is_email_whitelisted(email):
        raise HTTPException(status_code=403, detail="Email not authorized for access")
    
    # Create new user
    user = User(
        email=email,
        name=email.split('@')[0],
        google_id=f"user_{uuid.uuid4()}",
        is_admin=invitation_obj.is_admin_code,
        invitation_code_used=invitation_code
    )
    await db.users.insert_one(user.dict())
    
    # Mark invitation as used
    await db.invitation_codes.update_one(
        {"code": invitation_code},
        {
            "$set": {
                "is_used": True,
                "used_by": user.id,
                "used_at": datetime.utcnow()
            }
        }
    )
    
    # Log the registration
    await log_action(user.id, user.email, "user_registered", {"invitation_code": invitation_code})
    
    # Create JWT token
    token_data = {
        "email": user.email,
        "user_id": user.id,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    access_token = jwt.encode(token_data, "secret", algorithm="HS256")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user.email,
            "name": user.name,
            "is_admin": user.is_admin
        },
        "message": "Registration completed successfully"
    }

@api_router.post("/auth/admin-code")
async def use_admin_code(request: AdminCodeRequest):
    """Use admin code to create admin user"""
    if request.admin_code != ADMIN_CODE:
        raise HTTPException(status_code=403, detail="Invalid admin code")
    
    # Check if email is blacklisted
    if await is_email_blacklisted(request.email):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        # Make existing user admin
        await db.users.update_one(
            {"email": request.email},
            {"$set": {"is_admin": True}}
        )
        user = User(**existing_user)
        user.is_admin = True
    else:
        # Create new admin user
        user = User(
            email=request.email,
            name=request.email.split('@')[0],
            google_id=f"admin_{uuid.uuid4()}",
            is_admin=True,
            invitation_code_used="ADMIN_CODE"
        )
        await db.users.insert_one(user.dict())
    
    await log_action(user.id, user.email, "admin_promotion", {"method": "admin_code"})
    
    return {"message": "Admin privileges granted", "email": request.email}

# Garage control routes
@api_router.post("/garage/open")
async def open_garage(request: Request, user: User = Depends(get_current_user)):
    """Open the garage door"""
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")
    
    try:
        # Get Shelly device credentials from environment
        device_id = os.environ.get('SHELLY_DEVICE_ID')
        api_key = os.environ.get('SHELLY_API_KEY')
        
        if not device_id or not api_key:
            raise HTTPException(status_code=500, detail="Device configuration not available")
        
        # Call Shelly API to open garage
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://shelly-{device_id}.shelly.cloud/relay/0",
                params={"turn": "on", "timer": 1},
                headers={"Authorization": f"Bearer {api_key}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to control garage door")
        
        # Log the action
        client_ip = request.client.host
        await log_action(
            user.id, 
            user.email,
            "garage_open", 
            {"device_id": device_id}, 
            client_ip
        )
        
        return {"message": "Garage door activated", "timestamp": datetime.utcnow()}
        
    except Exception as e:
        await log_action(user.id, user.email, "garage_open_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to open garage: {str(e)}")

# Admin routes
@api_router.post("/admin/invitation-codes")
async def create_invitation_code(admin: User = Depends(admin_required)):
    """Create a new invitation code"""
    code = generate_invitation_code()
    expires_at = datetime.utcnow() + timedelta(days=30)
    
    invitation = InvitationCode(
        code=code,
        created_by=admin.id,
        expires_at=expires_at
    )
    
    await db.invitation_codes.insert_one(invitation.dict())
    await log_action(admin.id, admin.email, "invitation_created", {"code": code})
    
    return {"code": code, "expires_at": expires_at}

@api_router.get("/admin/invitation-codes")
async def get_invitation_codes(admin: User = Depends(admin_required)):
    """Get all invitation codes"""
    codes = await db.invitation_codes.find().sort("created_at", -1).to_list(100)
    return [InvitationCode(**code) for code in codes]

@api_router.get("/admin/users")
async def get_users(admin: User = Depends(admin_required)):
    """Get all users"""
    users = await db.users.find().sort("created_at", -1).to_list(100)
    return [User(**user) for user in users]

@api_router.put("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, is_active: bool, admin: User = Depends(admin_required)):
    """Activate/deactivate user"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": is_active}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_action(admin.id, admin.email, "user_status_updated", {"user_id": user_id, "is_active": is_active})
    return {"message": "User status updated"}

@api_router.put("/admin/users/{user_id}/admin")
async def toggle_admin_status(user_id: str, is_admin: bool, admin: User = Depends(admin_required)):
    """Grant/revoke admin privileges"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_admin": is_admin}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_action(admin.id, admin.email, "admin_status_updated", {"user_id": user_id, "is_admin": is_admin})
    return {"message": "Admin status updated"}

# Whitelist management
@api_router.post("/admin/whitelist")
async def add_to_whitelist(request: WhitelistRequest, admin: User = Depends(admin_required)):
    """Add email to whitelist"""
    # Check if already whitelisted
    existing = await db.whitelist.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already whitelisted")
    
    whitelist_entry = WhitelistEntry(
        email=request.email,
        added_by=admin.id
    )
    
    await db.whitelist.insert_one(whitelist_entry.dict())
    await log_action(admin.id, admin.email, "email_whitelisted", {"email": request.email})
    
    return {"message": f"Email {request.email} added to whitelist"}

@api_router.get("/admin/whitelist")
async def get_whitelist(admin: User = Depends(admin_required)):
    """Get whitelist entries"""
    entries = await db.whitelist.find().sort("created_at", -1).to_list(100)
    return [WhitelistEntry(**entry) for entry in entries]

@api_router.delete("/admin/whitelist/{email}")
async def remove_from_whitelist(email: str, admin: User = Depends(admin_required)):
    """Remove email from whitelist"""
    result = await db.whitelist.delete_one({"email": email})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email not found in whitelist")
    
    await log_action(admin.id, admin.email, "email_removed_from_whitelist", {"email": email})
    return {"message": f"Email {email} removed from whitelist"}

# Blacklist management
@api_router.post("/admin/blacklist")
async def add_to_blacklist(request: BlacklistRequest, admin: User = Depends(admin_required)):
    """Add email to blacklist"""
    # Check if already blacklisted
    existing = await db.blacklist.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already blacklisted")
    
    blacklist_entry = BlacklistEntry(
        email=request.email,
        reason=request.reason,
        added_by=admin.id
    )
    
    await db.blacklist.insert_one(blacklist_entry.dict())
    
    # Also blacklist the user if they exist
    await db.users.update_one(
        {"email": request.email},
        {"$set": {"is_blacklisted": True}}
    )
    
    await log_action(admin.id, admin.email, "email_blacklisted", {"email": request.email, "reason": request.reason})
    
    return {"message": f"Email {request.email} added to blacklist"}

@api_router.get("/admin/blacklist")
async def get_blacklist(admin: User = Depends(admin_required)):
    """Get blacklist entries"""
    entries = await db.blacklist.find().sort("created_at", -1).to_list(100)
    return [BlacklistEntry(**entry) for entry in entries]

@api_router.delete("/admin/blacklist/{email}")
async def remove_from_blacklist(email: str, admin: User = Depends(admin_required)):
    """Remove email from blacklist"""
    result = await db.blacklist.delete_one({"email": email})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email not found in blacklist")
    
    # Also unblacklist the user
    await db.users.update_one(
        {"email": email},
        {"$set": {"is_blacklisted": False}}
    )
    
    await log_action(admin.id, admin.email, "email_removed_from_blacklist", {"email": email})
    return {"message": f"Email {email} removed from blacklist"}

# System settings
@api_router.get("/admin/settings")
async def get_system_settings_admin(admin: User = Depends(admin_required)):
    """Get system settings"""
    settings = await get_system_settings()
    if not settings:
        settings = SystemSettings(
            maintenance_mode=False,
            updated_by=admin.id
        )
        await db.system_settings.insert_one(settings.dict())
    return settings

@api_router.put("/admin/settings/maintenance")
async def toggle_maintenance_mode(enabled: bool, message: str = "System under maintenance", admin: User = Depends(admin_required)):
    """Toggle maintenance mode"""
    settings = SystemSettings(
        maintenance_mode=enabled,
        maintenance_message=message,
        updated_by=admin.id
    )
    
    await db.system_settings.update_one(
        {},
        {"$set": settings.dict()},
        upsert=True
    )
    
    await log_action(admin.id, admin.email, "maintenance_mode_toggled", {"enabled": enabled, "message": message})
    return {"message": f"Maintenance mode {'enabled' if enabled else 'disabled'}"}

@api_router.get("/admin/audit-logs")
async def get_audit_logs(admin: User = Depends(admin_required), limit: int = 100, skip: int = 0):
    """Get audit logs with pagination"""
    logs = await db.audit_logs.find().sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents({})
    
    return {
        "logs": [AuditLog(**log) for log in logs],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/admin/stats")
async def get_admin_stats(admin: User = Depends(admin_required)):
    """Get system statistics"""
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    admin_users = await db.users.count_documents({"is_admin": True})
    blacklisted_users = await db.users.count_documents({"is_blacklisted": True})
    
    total_invitations = await db.invitation_codes.count_documents({})
    used_invitations = await db.invitation_codes.count_documents({"is_used": True})
    
    whitelist_count = await db.whitelist.count_documents({})
    blacklist_count = await db.blacklist.count_documents({})
    
    # Recent activity
    recent_logins = await db.audit_logs.count_documents({
        "action": "login",
        "timestamp": {"$gte": datetime.utcnow() - timedelta(days=7)}
    })
    
    recent_garage_opens = await db.audit_logs.count_documents({
        "action": "garage_open",
        "timestamp": {"$gte": datetime.utcnow() - timedelta(days=7)}
    })
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admins": admin_users,
            "blacklisted": blacklisted_users
        },
        "invitations": {
            "total": total_invitations,
            "used": used_invitations,
            "available": total_invitations - used_invitations
        },
        "access_control": {
            "whitelisted_emails": whitelist_count,
            "blacklisted_emails": blacklist_count
        },
        "recent_activity": {
            "logins_this_week": recent_logins,
            "garage_opens_this_week": recent_garage_opens
        }
    }

# User info route
@api_router.get("/user/me")
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "email": user.email,
        "name": user.name,
        "is_admin": user.is_admin,
        "is_active": user.is_active
    }

# Health check
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    settings = await get_system_settings()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "maintenance_mode": settings.maintenance_mode if settings else False
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

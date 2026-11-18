"""
FuelTaxPulse Authentication & Authorization Module
Handles JWT creation, verification, and role-based access control.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import jwt
from fastapi import HTTPException, status, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_connection, verify_password, hash_password

SECRET_KEY = "fueltaxpulse-super-secret-jwt-key-trucking-compliance-2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = Query(None)
) -> Dict:
    raw_token = credentials.credentials if credentials else token
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload."
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired or is invalid."
        )

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.email, u.full_name, u.role, u.org_id, o.name as org_name
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        WHERE u.id = ?
    """, (user_id,))
    row = cursor.fetchone()

    if row is None:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive."
        )

    # Fetch primary fleet for org
    cursor.execute("""
        SELECT id, name, ifta_account_number, base_jurisdiction
        FROM fleets
        WHERE org_id = ?
        ORDER BY id ASC
        LIMIT 1
    """, (row["org_id"],))
    fleet_row = cursor.fetchone()
    conn.close()

    default_fleet_id = fleet_row["id"] if fleet_row else None
    default_fleet_name = fleet_row["name"] if fleet_row else row["org_name"]
    ifta_acc = fleet_row["ifta_account_number"] if fleet_row else "PENDING"
    base_jur = fleet_row["base_jurisdiction"] if fleet_row else "AR"

    return {
        "id": row["id"],
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "org_id": row["org_id"],
        "org_name": row["org_name"],
        "default_fleet_id": default_fleet_id,
        "default_fleet_name": default_fleet_name,
        "ifta_account_number": ifta_acc,
        "base_jurisdiction": base_jur,
    }

"""
FuelTaxPulse Pydantic Data Models & Schemas
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any

# --- Authentication Schemas ---
class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    company_name: str
    base_jurisdiction: str = Field("AR", min_length=2, max_length=2)
    ifta_account_number: Optional[str] = "PENDING-IFTA"
    dot_number: Optional[str] = None
    role: Optional[str] = "fleet_manager"

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    org_id: str
    org_name: str
    default_fleet_id: Optional[str] = None
    default_fleet_name: Optional[str] = None
    ifta_account_number: Optional[str] = None
    base_jurisdiction: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Vehicle / Power Unit Schemas ---
class VehicleCreateRequest(BaseModel):
    unit_number: str
    vin: str = Field(..., min_length=11, max_length=17)
    make: Optional[str] = "Freightliner"
    model: Optional[str] = "Cascadia"
    model_year: Optional[int] = 2024
    fuel_type: str = "Diesel"
    gross_vehicle_weight: int = 80000
    number_of_axles: int = 5

class VehicleUpdateRequest(BaseModel):
    unit_number: str
    vin: str = Field(..., min_length=11, max_length=17)
    make: Optional[str] = "Freightliner"
    model: Optional[str] = "Cascadia"
    model_year: Optional[int] = 2024
    fuel_type: str = "Diesel"
    gross_vehicle_weight: int = 80000
    number_of_axles: int = 5
    is_active: Optional[bool] = True

class VehicleResponse(BaseModel):
    id: str
    fleet_id: str
    unit_number: str
    vin: str
    make: Optional[str]
    model: Optional[str]
    model_year: Optional[int]
    fuel_type: str
    gross_vehicle_weight: int
    number_of_axles: int
    is_active: bool

# --- Trip & Segment Schemas ---
class TripSegmentInput(BaseModel):
    jurisdiction: str
    all_miles: float
    non_toll_miles: Optional[float] = None
    toll_miles: Optional[float] = 0.0
    thruway_toll_miles: Optional[float] = 0.0
    permitted_miles: Optional[float] = 0.0
    off_road_miles: Optional[float] = 0.0
    taxable_miles: Optional[float] = None

class TripCreateRequest(BaseModel):
    vehicle_id: str
    trip_number: Optional[str] = None
    trip_date: str
    quarter: str = "2026-Q1"
    entry_method: str = "distance"
    segments: List[TripSegmentInput]
    notes: Optional[str] = None

class RouteValidationRequest(BaseModel):
    jurisdictions: List[str]

# --- Fuel Purchase Schemas ---
class FuelPurchaseCreateRequest(BaseModel):
    vehicle_id: Optional[str] = None
    unit_number: Optional[str] = None
    purchase_date: str
    quarter: str = "2026-Q1"
    jurisdiction: str
    fuel_type: str = "Diesel"
    gallons: float
    is_tax_paid: bool = True
    vendor: Optional[str] = None
    receipt_number: Optional[str] = None
    total_cost: Optional[float] = None

# --- ZIP Distance Calculation Schema (Module 4) ---
class ZipDistanceRequest(BaseModel):
    origin_zip: str
    destination_zip: str

# --- Quick Calculator Sandbox Schema ---
class CalculatorStateRow(BaseModel):
    state: str
    miles: float
    gallons: float

class QuickCalculatorRequest(BaseModel):
    quarter: str = "2026-Q1"
    fuel_type: str = "Diesel"
    state_data: List[CalculatorStateRow]

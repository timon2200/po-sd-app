from datetime import date
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel

class TransactionType(str, Enum):
    INFLOW = "inflow"
    OUTFLOW = "outflow"

class TaxBracket(BaseModel):
    max_receipts: float
    base_tax_liability: float
    tax_base: float
    description: str

class TransactionCategory(str, Enum):
    BUSINESS_INCOME = "business_income"  # Counts towards PO-SD
    PERSONAL_DEPOSIT = "personal_deposit" # Does not count
    REFUND = "refund"
    BUSINESS_EXPENSE = "business_expense"
    TAX_PAYMENT = "tax_payment"
    OTHER = "other"

class Transaction(BaseModel):
    id: Optional[str] = None # Unique hash
    date: date
    description: str
    amount: float
    currency: str = "EUR"
    type: TransactionType
    category: TransactionCategory
    raw_reference: Optional[str] = None
    source_file: Optional[str] = None # Filename of the source document
    
    # PO-SD Smart Check fields
    is_excluded_from_posd: bool = False
    posd_note: Optional[str] = None
    tax_type: Optional[str] = None # 'tax' or 'surtax'

class POSDData(BaseModel):
    oib: str
    name: str = "Timon Terzić" # Default for now or extract
    address: str = "STANKA VRAZA 10, VARAŽDIN" # Default
    year: int
    total_receipts: float
    tax_paid: float
    surtax_paid: float
    tax_bracket: Optional[str] = None
    base_tax_liability: Optional[float] = 0.0
    annual_tax_base: Optional[float] = 0.0
    all_brackets: Optional[List[TaxBracket]] = None


class Client(BaseModel):
    id: Optional[str] = None
    name: str # Tvrtka / Ime
    oib: str # OIB
    address: str # Ulica i broj
    city: str # Mjesto
    postal_code: Optional[str] = None
    country: str = "HR"
    email: Optional[str] = None

class Settings(BaseModel):
    xml_path: str
    google_creds_path: str
    sudreg_client_id: Optional[str] = None
    sudreg_client_secret: Optional[str] = None

class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    OPEN = "open"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    TEMPLATE = "template"

class InvoiceItem(BaseModel):
    id: str
    description: str
    quantity: float
    price: float
    discount: float = 0.0
    tax: float = 25.0

class Invoice(BaseModel):
    id: Optional[str] = None
    number: str # e.g. "R-2025-01"
    year: int
    issue_date: date
    due_date: date
    
    # Client snapshot (in case client details change later)
    client_id: Optional[str] = None
    client_name: str
    client_oib: str
    client_address: str
    client_city: str
    client_zip: Optional[str] = None
    
    items: List[InvoiceItem]
    notes: Optional[str] = ""
    
    subtotal: float
    tax_total: float
    total_amount: float
    
    status: InvoiceStatus = InvoiceStatus.DRAFT
    
    # Audit
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


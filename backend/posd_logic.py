from pydantic import BaseModel
from typing import List, Optional

from backend.models import Transaction, TaxBracket

# Official 2024/2025 Brackets (Values in EUR)
# Official 2024 Brackets (Values in EUR)
# Source: Porezna uprava / Zakon o porezu na dohodak
PAUSAL_TIERS_2024 = [
    TaxBracket(max_receipts=11500.00, tax_base=12750.00, base_tax_liability=199.08, description="I. Razina (do 11.500,00 €)"),
    TaxBracket(max_receipts=17250.00, tax_base=17250.00, base_tax_liability=290.72, description="II. Razina (do 17.250,00 €)"),
    TaxBracket(max_receipts=23000.00, tax_base=23000.00, base_tax_liability=398.17, description="III. Razina (do 23.000,00 €)"),
    TaxBracket(max_receipts=34500.00, tax_base=34500.00, base_tax_liability=663.61, description="IV. Razina (do 34.500,00 €)"),
    TaxBracket(max_receipts=40000.00, tax_base=40000.00, base_tax_liability=875.97, description="V. Razina (do 40.000,00 €)"),
]

# Official 2025 Brackets (Values in EUR)
# Source: Porezna uprava (new 60k limit, effective 2025)
PAUSAL_TIERS_2025 = [
    TaxBracket(max_receipts=11300.00, tax_base=1695.00, base_tax_liability=203.40, description="1. Razina (do 11.300,00 €)"),
    TaxBracket(max_receipts=15300.00, tax_base=2295.00, base_tax_liability=275.40, description="2. Razina (do 15.300,00 €)"),
    TaxBracket(max_receipts=19900.00, tax_base=2985.00, base_tax_liability=358.20, description="3. Razina (do 19.900,00 €)"),
    TaxBracket(max_receipts=30600.00, tax_base=4590.00, base_tax_liability=550.80, description="4. Razina (do 30.600,00 €)"),
    TaxBracket(max_receipts=40000.00, tax_base=6000.00, base_tax_liability=720.00, description="5. Razina (do 40.000,00 €)"),
    TaxBracket(max_receipts=50000.00, tax_base=7500.00, base_tax_liability=900.00, description="6. Razina (do 50.000,00 €)"),
    TaxBracket(max_receipts=60000.00, tax_base=9000.00, base_tax_liability=1080.00, description="7. Razina (do 60.000,00 €)"),
]

def get_tax_bracket(total_receipts: float, year: int = 2024) -> Optional[TaxBracket]:
    tiers = PAUSAL_TIERS_2025 if year >= 2025 else PAUSAL_TIERS_2024
    
    for bracket in tiers:
        if total_receipts <= bracket.max_receipts:
            return bracket
    return tiers[-1] # Fallback to max

def calculate_posd_obligation(total_receipts: float, tax_rate_percent: float = 10.0) -> float:
    """
    Returns the base annual tax obligation (without surtax).
    Actually, the 'base_tax_liability' in tiers is usually fixed per tier.
    Let's use the fixed liability from the tier for simplicity, 
    as paušal tax is fixed per bracket, not percentage of receipt.
    """
    # Note: This function signature was legacy and didn't take year.
    # Defaulting to 2024 for safety, but callers should update if possible.
    # However, this function isn't used in main.py, get_tax_bracket is.
    bracket = get_tax_bracket(total_receipts, year=2024)
    if bracket:
        return bracket.base_tax_liability
    return 0.0

def calculate_paid_tax(transactions: List["Transaction"], year: int) -> tuple[float, float]:
    """
    Calculates the total paid tax and surtax for the given year.
    Returns: (tax_paid, surtax_paid)
    Logic:
    1. Filter by year.
    2. Filter by OUTFLOW.
    3. Identify tax/surtax payments:
       - Check `tax_type` field override first.
       - Else check raw_reference ('HR68 1449' => tax)
       - Else check description ("POREZ NA DOHODAK" => tax, "PRIREZ" => surtax)
    """
    total_tax = 0.0
    total_surtax = 0.0
    
    for tx in transactions:
        # Check date: either in the target year OR in first 15 days of next year
        in_current_year = (tx.date.year == year)
        in_grace_period = (tx.date.year == year + 1 and tx.date.month == 1 and tx.date.day <= 15)
        
        if (in_current_year or in_grace_period) and tx.type == "outflow":
            # 1. Check manual override
            if tx.tax_type == 'tax':
                total_tax += tx.amount
                continue
            elif tx.tax_type == 'surtax':
                total_surtax += tx.amount
                continue
            
            # 2. Heuristics
            is_tax = False
            is_surtax = False
            
            # Check raw reference for specific revenue code 1449 (Porez na dohodak)
            if tx.raw_reference and "HR68 1449" in tx.raw_reference:
                is_tax = True
            
            # Fallback to description
            if not is_tax and not is_surtax:
                desc_upper = tx.description.upper()
                if "PRIREZ" in desc_upper:
                    is_surtax = True
                elif "POREZ NA DOHODAK" in desc_upper:
                    is_tax = True
            
            if is_tax:
                total_tax += tx.amount
            if is_surtax:
                total_surtax += tx.amount
                
    return total_tax, total_surtax

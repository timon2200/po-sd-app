
import segno
import io
import base64

def generate_epc_qr_code(
    iban: str,
    amount: float,
    payee_name: str,
    payment_reference: str, # e.g. "HR00-123456"
    purpose_code: str = "COST", # or OTHR, etc.
    description: str = "",
    payee_address: str = "",
    payee_city: str = "",
    bic: str = "",
    payer_name: str = "",
    payer_address: str = "",
    payer_city: str = ""
) -> str:
    """
    Generates a Croatian "Slikaj i plati" (EPC) QR code base64 string.
    
    Format:
    BCD
    002
    1 (Character set: 1=UTF-8)
    SCT
    BIC (optional)
    Payee Name
    IBAN
    Amount (EUR123.45)
    Purpose Code (4 chars)
    Reference (up to 35 chars)
    Remittance Information (Description)
    """
    
    # Clean inputs
    iban = iban.replace(" ", "").upper()
    amount_str = f"EUR{amount:.2f}"
    
    # Construct the data string according to EPC069-12 default guidelines customized for HR hub3/slikaj-i-plati usage often relies on similar structure.
    # However, the official "Vjerni Hrvat" / HUB3 standard might differ slightly.
    # Let's use the standard EPC-QR format which is widely accepted in Croatia.
    
    # EPC Quick Response Code Guidelines:
    # Service Tag: BCD
    # Version: 002
    # Character Set: 1 (UTF-8) or 2 (Latin)
    # Identification: SCT
    # BIC: [BIC]
    # Name: [Payee Name]
    # IBAN: [IBAN]
    # Amount: [Amount]
    # Purpose: [Purpose Code] (Optional)
    # Remittance Ref: [Ref] (Optional)
    # Remittance Text: [Description] (Optional)
    # The fields are separate by newlines (CR+LF or LF).
    
    # NOTE: Croatia specific usage often splits Reference into Model and Number if using the HUB3 paper form, but for QR usually the Ref includes model (e.g. HR99...).
    
    lines = [
        "BCD",
        "002",
        "1",
        "SCT",
        bic if bic else "",
        payee_name[:70],
        iban,
        amount_str,
        purpose_code if purpose_code else "",
        payment_reference if payment_reference else "",
        description[:140] if description else "",
        "" # Display (optional)
    ]
    
    data = "\n".join(lines)
    
    # Generate QR
    qr = segno.make(data, error='M') # M level is standard
    
    # Output to buffer
    buff = io.BytesIO()
    qr.save(buff, kind='png', scale=4)
    buff.seek(0)
    
    # Encode to base64
    img_str = base64.b64encode(buff.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_str}"

if __name__ == "__main__":
    # Test
    print(generate_epc_qr_code(
        iban="HR1234567890123456789",
        amount=100.50,
        payee_name="Test Payee",
        payment_reference="HR99-123456"
    ))

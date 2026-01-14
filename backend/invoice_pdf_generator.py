from xhtml2pdf import pisa
import io
import base64
import os
from datetime import datetime
from backend.models import Invoice, InvoiceStatus
from backend.barcode_utils import generate_epc_qr_code

def generate_invoice_pdf(invoice: Invoice, issuer: dict) -> bytes:
    """
    Generates a PDF Invoice based on the invoice model and issuer details.
    Uses DejaVu Sans for UTF-8 support.
    """
    
    # Format dates
    issue_date_str = invoice.issue_date.strftime('%d.%m.%Y.')
    due_date_str = invoice.due_date.strftime('%d.%m.%Y.')
    
    # Generate QR Code
    qr_code_b64 = None
    if invoice.total_amount > 0 and issuer.get('iban'):
        try:
            # Construct payment reference (Model and Number)
            clean_number = ''.join(filter(str.isdigit, invoice.number))
            reference = f"HR01 {clean_number}"
            
            qr_code_b64 = generate_epc_qr_code(
                iban=issuer.get('iban'),
                amount=invoice.total_amount,
                payee_name=issuer.get('name'),
                payment_reference=reference,
                description=f"Placanje racuna {invoice.number}",
                purpose_code="COST"
            )
        except Exception as e:
            print(f"QR Code generation failed: {e}")

    # Prepare Items HTML
    items_html = ""
    for item in invoice.items:
        # Calculate line total
        line_total = item.quantity * item.price * (1 - (item.discount or 0) / 100)
        
        items_html += f"""
        <tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #f8fafc;">
                <div style="font-weight: bold; color: #1e293b;">{item.description}</div>
            </td>
            <td class="text-right" style="padding: 12px 8px; border-bottom: 1px solid #f8fafc;">{item.quantity:.2f}</td>
            <td class="text-right" style="padding: 12px 8px; border-bottom: 1px solid #f8fafc;">{item.price:.2f} €</td>
            <td class="text-right" style="padding: 12px 8px; border-bottom: 1px solid #f8fafc;">{f'{item.discount}%' if item.discount else '-'}</td>
            <td class="text-right" style="padding: 12px 8px; border-bottom: 1px solid #f8fafc; font-weight: bold; color: #1e293b;">{line_total:.2f} €</td>
        </tr>
        """

    # Resolve font path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    font_path_regular = os.path.join(current_dir, 'fonts', 'DejaVuSans.ttf')
    font_path_bold = os.path.join(current_dir, 'fonts', 'DejaVuSans-Bold.ttf')

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @font-face {{
                font-family: 'DejaVuSans';
                src: url('{font_path_regular}');
            }}
            @font-face {{
                font-family: 'DejaVuSans';
                font-weight: bold;
                src: url('{font_path_bold}');
            }}
            
            @page {{
                size: A4;
                margin: 0;
                padding: 0;
                @frame header_frame {{
                    -pdf-frame-content: headerContent;
                    left: 2.5cm;
                    right: 2.5cm;
                    top: 1.5cm;
                    height: 2.5cm;
                }}
                @frame content_frame {{
                    left: 2.5cm;
                    right: 2.5cm;
                    top: 4.5cm;
                    bottom: 3.5cm;
                }}
                @frame footer_frame {{
                    -pdf-frame-content: footerContent;
                    left: 2.5cm;
                    right: 2.5cm;
                    bottom: 1.5cm;
                    height: 1cm;
                }}
            }}
            
            body {{
                font-family: 'DejaVuSans', Helvetica, Arial, sans-serif;
                font-size: 10pt;
                line-height: 1.5;
                color: #334155; /* Slate 700 */
                background-color: #ffffff;
            }}
            
            /* Typography */
            h1 {{ font-size: 28pt; color: #cbd5e1; font-weight: 300; margin: 0; letter-spacing: 2px; text-transform: uppercase; }}
            .text-sm {{ font-size: 9pt; }}
            .text-xs {{ font-size: 8pt; }}
            .font-bold {{ font-weight: bold; }}
            .text-right {{ text-align: right; }}
            .text-indigo {{ color: #4f46e5; }}
            
            /* Components */
            .logo-box {{
                width: 32px;
                height: 32px;
                background-color: #4f46e5;
                color: white;
                text-align: center;
                vertical-align: middle;
                font-size: 18pt;
                font-weight: bold;
                border-radius: 6px;
                padding-top: 5px; /* Visual fix for vertical align */
            }}
            
            .header-table {{
                width: 100%;
                border-bottom: 2px solid #ffffff; /* Visual spacer if needed */
            }}
            
            .info-grid {{
                width: 100%;
                margin-bottom: 40px;
            }}
            .label {{
                font-size: 7pt;
                font-weight: bold;
                text-transform: uppercase;
                color: #94a3b8; /* Slate 400 */
                margin-bottom: 4px;
            }}
            
            .dates-grid {{
                width: 100%;
                margin-bottom: 40px;
                padding: 15px 0;
                border-top: 1px solid #f1f5f9;
                border-bottom: 1px solid #f1f5f9;
            }}
            
            /* Table */
            table.items {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }}
            table.items th {{
                text-align: left;
                font-size: 7pt;
                text-transform: uppercase;
                color: #94a3b8;
                padding: 0 8px 10px 8px;
            }}
            
            /* Totals */
            .totals-table {{
                width: 100%;
                margin-top: 20px;
            }}
            .total-row td {{
                padding: 4px 0;
                text-align: right;
            }}
            .final-total {{
                color: #4f46e5;
                font-size: 14pt;
                font-weight: bold;
                padding-top: 10px;
                margin-top: 10px;
                border-top: 1px solid #e2e8f0;
            }}
            
            /* QR & Notes */
            .qr-container {{
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 10px;
                display: inline-block;
                text-align: center;
            }}
            
            #footerContent {{
                font-size: 8pt;
                color: #94a3b8;
                text-align: center;
                border-top: 1px solid #f1f5f9;
                padding-top: 15px;
            }}
        </style>
    </head>
    <body>
        
        <!-- Static Header -->
        <div id="headerContent">
            <table class="header-table">
                <tr>
                    <td width="50%" valign="top">
                        <table cellspacing="0" cellpadding="0">
                            <tr>
                                <td width="40"><div class="logo-box">P</div></td>
                                <td style="padding-left: 10px; font-size: 14pt; font-weight: bold; color: #0f172a;">{issuer.get('name')}</td>
                            </tr>
                        </table>
                    </td>
                    <td width="50%" align="right" valign="top">
                        <h1>Račun</h1>
                        <div style="font-weight: bold; color: #334155; margin-top: 5px;">Broj: {invoice.number}</div>
                        <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">Ref: {invoice.number.replace('R-', '')}</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Info Grid -->
        <table class="info-grid" cellspacing="0" cellpadding="0">
            <tr>
                <td width="50%" valign="top">
                    <div class="label">IZDAVATELJ</div>
                    <div style="font-weight: bold; color: #1e293b; font-size: 10pt; margin-bottom: 2px;">{issuer.get('name')}</div>
                    <div class="text-sm" style="color: #64748b; line-height: 1.4;">
                        {issuer.get('address')}<br/>
                        <span style="color: #64748b;">OIB:</span> {issuer.get('oib')}<br/>
                        <span style="color: #64748b;">IBAN:</span> {issuer.get('iban')}
                    </div>
                </td>
                <td width="50%" valign="top">
                    <div class="label">ZA KORISNIKA</div>
                    <div style="font-weight: bold; color: #1e293b; font-size: 10pt; margin-bottom: 2px;">{invoice.client_name}</div>
                    <div class="text-sm" style="color: #64748b; line-height: 1.4;">
                        {invoice.client_address}<br/>
                        {invoice.client_zip} {invoice.client_city}<br/>
                        <span style="color: #64748b;">OIB:</span> {invoice.client_oib}
                    </div>
                </td>
            </tr>
        </table>

        <!-- Dates -->
        <table class="dates-grid" cellspacing="0" cellpadding="0">
            <tr>
                <td width="25%">
                    <div class="label">DATUM IZDAVANJA</div>
                    <div style="font-weight: 500;">{issue_date_str}</div>
                </td>
                <td width="25%">
                    <div class="label">DATUM DOSPIJEĆA</div>
                    <div style="font-weight: bold; color: #4f46e5;">{due_date_str}</div>
                </td>
                <td width="25%">
                    <div class="label">NAČIN PLAĆANJA</div>
                    <div>Transakcijski račun</div>
                </td>
                <td width="25%">
                    <div class="label">VALUTA</div>
                    <div>EUR</div>
                </td>
            </tr>
        </table>

        <!-- Items Items -->
        <table class="items" cellspacing="0" cellpadding="0">
            <thead>
                <tr>
                    <th width="40%">Opis Usluge / Proizvoda</th>
                    <th width="10%" class="text-right">Kol.</th>
                    <th width="15%" class="text-right">Cijena</th>
                    <th width="10%" class="text-right">Popust</th>
                    <th width="25%" class="text-right">Ukupno</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>

        <!-- Footer Section (Totals + QR) -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
            <tr>
                <td width="60%" valign="bottom">
                    {f'''
                    <div class="qr-container">
                        <div class="label" style="margin-bottom: 5px;">SLIKAJ I PLATI</div>
                        <img src="{qr_code_b64}" width="120" height="120" />
                    </div>
                    ''' if qr_code_b64 else ''}
                </td>
                <td width="40%" valign="top">
                    <table class="totals-table">
                        <tr class="total-row">
                            <td class="text-sm" style="color: #64748b;">Iznos bez PDV-a:</td>
                            <td style="font-weight: bold;">{invoice.subtotal:.2f} €</td>
                        </tr>
                        <tr class="total-row">
                            <td class="text-sm" style="color: #64748b;">PDV ({(invoice.tax_total / invoice.subtotal * 100 if invoice.subtotal > 0 else 25):.0f}%):</td>
                            <td style="color: #475569;">{invoice.tax_total:.2f} €</td>
                        </tr>
                        <tr>
                            <td colspan="2" align="right">
                                <div class="final-total">
                                    <span style="font-size: 10pt; font-weight: normal; color: #64748b; margin-right: 10px;">ZA PLATITI:</span>
                                    {invoice.total_amount:.2f} €
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Notes -->
        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
            <div class="label">NAPOMENA</div>
            <div class="text-sm" style="color: #475569; margin-top: 5px;">
                {invoice.notes or 'Obveznik nije u sustavu PDV-a, PDV nije obračunat temeljem čl. 90. st. 1. Zakona o PDV-u.'}
            </div>
            <div style="margin-top: 30px; font-size: 8pt; color: #94a3b8;">
                Generirano putem <strong style="color: #4f46e5;">PO-SD App</strong> | Hvala na povjerenju!
            </div>
        </div>

        <!-- Static Footer -->
        <div id="footerContent">
            {issuer.get('name')} | OIB: {issuer.get('oib')} | IBAN: {issuer.get('iban')} | www.lotus-rc.hr
        </div>

    </body>
    </html>
    """
    
    # Generate PDF
    output_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        html_content,
        dest=output_buffer,
        encoding='utf-8'
    )
    
    if pisa_status.err:
        raise Exception("Error generating PDF invoice")
        
    return output_buffer.getvalue()

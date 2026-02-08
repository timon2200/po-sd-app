try:
    from xhtml2pdf import pisa
except ImportError:
    pisa = None
import io
import os
from datetime import datetime
from backend.models import Invoice
from backend.barcode_utils import generate_epc_qr_code

def generate_invoice_pdf(invoice: Invoice, issuer: dict) -> bytes:
    if pisa is None:
        raise Exception("PDF generation disabled: xhtml2pdf not installed")

    # Format dates
    issue_date_str = invoice.issue_date.strftime('%d.%m.%Y.')
    due_date_str = invoice.due_date.strftime('%d.%m.%Y.')
    
    # Generate QR Code
    qr_code_b64 = None
    if invoice.total_amount > 0 and issuer.get('iban'):
        try:
            clean_number = ''.join(filter(str.isdigit, invoice.number))
            if not clean_number:
                clean_number = "0"
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
        line_total = item.quantity * item.price * (1 - (item.discount or 0) / 100)
        
        items_html += f"""
        <tr>
            <td class="py-3 border-b" style="text-align: left;">
                <div class="font-medium text-slate-800">{item.description}</div>
            </td>
            <td class="py-3 border-b text-right">{item.quantity}</td>
            <td class="py-3 border-b text-right">{item.price:.2f} €</td>
            <td class="py-3 border-b text-right text-slate-400">{f'{item.discount}%' if item.discount else '-'}</td>
            <td class="py-3 border-b text-right font-medium text-slate-800">{line_total:.2f} €</td>
        </tr>
        """

    # Tailwind-inspired CSS Colors
    color_slate_900 = "#0f172a"
    color_slate_800 = "#1e293b"
    color_slate_700 = "#334155"
    color_slate_500 = "#64748b"
    color_slate_400 = "#94a3b8"
    color_slate_200 = "#e2e8f0"
    color_indigo_600 = "#4f46e5"
    # Fonts
    # xhtml2pdf works best with a link_callback for resources
    # We will use simple relative paths in CSS and resolve them in the callback
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    def link_callback(uri, rel):
        """
        Convert HTML URIs to absolute system paths so xhtml2pdf can verify resources
        """
        # Resolve path relative to this file's directory
        # This handles 'fonts/DejaVuSans.ttf' -> '/abs/path/to/backend/fonts/DejaVuSans.ttf'
        if not uri.startswith('http'):
             # If it's a file path
            if 'fonts/' in uri:
                path = os.path.join(current_dir, uri)
            else:
                path = os.path.join(current_dir, uri)
                
            if os.path.isfile(path):
                return path
        return uri

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @font-face {{
                font-family: 'DejaVuSans';
                src: url('fonts/DejaVuSans.ttf');
            }}
            @font-face {{
                font-family: 'DejaVuSans';
                font-weight: bold;
                src: url('fonts/DejaVuSans-Bold.ttf');
            }}
            
            @page {{
                size: A4;
                margin: 1.5cm;
            }}
            
            body {{
                font-family: 'DejaVuSans', sans-serif;
                font-size: 10pt;
                color: {color_slate_900};
                line-height: 1.5;
            }}
            /* ... rest of CSS ... */
            /* Utils */
            .text-right {{ text-align: right; }}
            .text-center {{ text-align: center; }}
            .font-bold {{ font-weight: bold; }}
            .uppercase {{ text-transform: uppercase; }}
            .text-xs {{ font-size: 8pt; }}
            .text-sm {{ font-size: 9pt; }}
            .text-lg {{ font-size: 12pt; }}
            .text-xl {{ font-size: 14pt; }}
            .text-3xl {{ font-size: 24pt; }}
            
            .text-slate-300 {{ color: #cbd5e1; }}
            .text-slate-400 {{ color: {color_slate_400}; }}
            .text-slate-500 {{ color: {color_slate_500}; }}
            .text-slate-700 {{ color: {color_slate_700}; }}
            .text-slate-800 {{ color: {color_slate_800}; }}
            .text-indigo-600 {{ color: {color_indigo_600}; }}
            
            .mb-1 {{ margin-bottom: 4px; }}
            .mb-2 {{ margin-bottom: 8px; }}
            .mb-4 {{ margin-bottom: 16px; }}
            .mt-4 {{ margin-top: 16px; }}
            .py-3 {{ padding-top: 10px; padding-bottom: 10px; }}
            
            .border-b {{ border-bottom: 1px solid {color_slate_200}; }}
            .border-t {{ border-top: 1px solid {color_slate_200}; }}
            
            /* Components */
            .logo-box {{
                width: 30px;
                height: 30px;
                background-color: {color_indigo_600};
                color: white;
                text-align: center;
                vertical-align: middle;
                font-weight: bold;
                font-size: 14pt;
                padding-top: 5px; /* Adjust for vertical alignment */
                border-radius: 4px;
            }}
            
            table.layout-grid {{ width: 100%; border-collapse: collapse; }}
            table.layout-grid td {{ vertical-align: top; }}
            
            /* Items Table */
            table.items-table {{ width: 100%; border-collapse: collapse; margin-top: 30px; }}
            table.items-table th {{
                text-align: left;
                font-size: 8pt;
                text-transform: uppercase;
                color: {color_slate_400};
                padding-bottom: 10px;
                border-bottom: 1px solid {color_slate_200};
            }}
             table.items-table th.text-right {{ text-align: right; }}
            
            /* Totals Table */
            table.totals-table {{ width: 100%; margin-top: 20px; }}
            table.totals-table td {{ padding: 4px 0; }}
            
            .qr-container {{
                border: 1px solid {color_slate_200};
                padding: 10px;
                border-radius: 8px;
                display: inline-block;
                background-color: white;
            }}
            
        </style>
    </head>
    <body>
        
        <!-- Header -->
        <table class="layout-grid" style="margin-bottom: 40px;">
            <tr>
                <td width="50%">
                    <table cellspacing="0" cellpadding="0">
                        <tr>
                            <td width="40"><div class="logo-box">P</div></td>
                            <td valign="middle" style="padding-left: 10px;">
                                <div class="text-xl font-bold text-slate-900">{issuer.get('name')}</div>
                            </td>
                        </tr>
                    </table>
                </td>
                <td width="50%" class="text-right">
                    <div class="text-3xl font-light text-slate-300 uppercase" style="letter-spacing: 2px;">Račun</div>
                    <div class="text-sm font-bold text-slate-700">Broj: {invoice.number}</div>
                    <div class="text-xs text-slate-500">Ref: {datetime.now().strftime('%f')[:6]}</div>
                </td>
            </tr>
        </table>
        
        <!-- Info Grid -->
        <table class="layout-grid" style="margin-bottom: 40px;">
            <tr>
                <td width="50%">
                    <div class="text-xs font-bold text-slate-400 uppercase mb-2" style="letter-spacing: 1px;">Izdavatelj</div>
                    <div class="text-sm font-bold text-slate-800 mb-1">{issuer.get('name')}</div>
                    <div class="text-xs text-slate-500" style="line-height: 1.6;">
                        {issuer.get('address')}<br/>
                        OIB: {issuer.get('oib')}<br/>
                        IBAN: {issuer.get('iban')}
                    </div>
                </td>
                <td width="50%">
                    <div class="text-xs font-bold text-slate-400 uppercase mb-2" style="letter-spacing: 1px;">Za Korisnika</div>
                    <div class="text-sm font-bold text-slate-800 mb-1">{invoice.client_name}</div>
                    <div class="text-xs text-slate-500" style="line-height: 1.6;">
                        {invoice.client_address}<br/>
                        {invoice.client_zip} {invoice.client_city}<br/>
                        OIB: {invoice.client_oib}
                    </div>
                </td>
            </tr>
        </table>
        
        <!-- Dates Grid -->
        <table class="layout-grid border-t border-b" style="padding: 15px 0;">
            <tr>
                <td width="25%">
                    <div class="text-xs font-bold text-slate-400 uppercase mb-1">Datum Izdavanja</div>
                    <div class="text-sm font-bold">{issue_date_str}</div>
                </td>
                <td width="25%">
                    <div class="text-xs font-bold text-slate-400 uppercase mb-1">Datum Dospijeća</div>
                    <div class="text-sm font-bold text-indigo-600">{due_date_str}</div>
                </td>
                <td width="25%">
                    <div class="text-xs font-bold text-slate-400 uppercase mb-1">Način Plaćanja</div>
                    <div class="text-sm font-bold">Transakcijski račun</div>
                </td>
                <td width="25%">
                    <div class="text-xs font-bold text-slate-400 uppercase mb-1">Valuta</div>
                    <div class="text-sm font-bold">EUR</div>
                </td>
            </tr>
        </table>
        
        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th width="40%">Opis Usluge / Proizvoda</th>
                    <th width="15%" class="text-right">Kol.</th>
                    <th width="15%" class="text-right">Cijena</th>
                    <th width="10%" class="text-right">Popust</th>
                    <th width="20%" class="text-right">Ukupno</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>
        
        <!-- Footer / Totals -->
        <table class="layout-grid" style="margin-top: 30px;">
            <tr>
                <td width="50%">
                    {f'''
                    <div class="qr-container">
                        <div class="text-xs font-bold text-center text-slate-400 uppercase mb-1">Slikaj i Plati</div>
                        <img src="{qr_code_b64}" width="100" height="100" />
                    </div>
                    ''' if qr_code_b64 else ''}
                </td>
                <td width="50%">
                    <table class="totals-table">
                        <tr>
                            <td class="text-right text-sm text-slate-500">Iznos bez PDV-a:</td>
                            <td class="text-right font-bold text-slate-800" width="100">{invoice.subtotal:.2f} €</td>
                        </tr>
                        <tr>
                            <td class="text-right text-sm text-slate-500">PDV ({(invoice.tax_total/invoice.subtotal*100) if invoice.subtotal else 25:.0f}%):</td>
                            <td class="text-right text-sm text-slate-500">{invoice.tax_total:.2f} €</td>
                        </tr>
                        <tr>
                            <td class="text-right text-lg font-bold text-slate-900 border-t" style="padding-top: 10px;">Za platiti:</td>
                            <td class="text-right text-lg font-bold text-indigo-600 border-t" style="padding-top: 10px;">
                                {invoice.total_amount:.2f} €
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <!-- Bottom Notes -->
        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid {color_slate_200};">
            <div class="text-xs font-bold text-slate-500 uppercase mb-2">Napomena:</div>
            <div class="text-xs text-slate-400">{invoice.notes or ''}</div>
            
            <table width="100%" style="margin-top: 20px;">
                <tr>
                    <td class="text-xs text-slate-400">Generirano putem <span class="text-indigo-600 font-bold">PO-SD App</span></td>
                    <td class="text-right text-xs text-slate-400">Hvala na povjerenju!</td>
                </tr>
            </table>
        </div>
        
    </body>
    </html>
    """
    
    # Generate PDF
    output_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        html_content,
        dest=output_buffer,
        encoding='utf-8',
        link_callback=link_callback
    )
    
    if pisa_status.err:
        raise Exception("Error generating PDF invoice")
        
    return output_buffer.getvalue()

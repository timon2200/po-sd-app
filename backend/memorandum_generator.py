try:
    from xhtml2pdf import pisa
except ImportError:
    pisa = None
import io
from datetime import datetime
from backend.models import POSDData, Transaction

def generate_memorandum_pdf(posd_data: POSDData, transactions: list[Transaction], year: int) -> bytes:
    if pisa is None:
        raise Exception("PDF generation disabled: xhtml2pdf not installed")
    """
    Generates a PDF Memorandum for the PO-SD form.
    It lists all transactions, highlighting those excluded from the PO-SD calculation
    and displaying user-provided notes.
    """
    
    # Filter transactions for the relevant year
    year_txs = [
        tx for tx in transactions 
        if tx.date.year == year and tx.type == "inflow"
    ]
    
    # Sort by date
    year_txs.sort(key=lambda x: x.date)
    
    formatted_date = datetime.now().strftime("%d.%m.%Y.")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @page {{
                size: A4;
                margin: 2cm;
                @frame footer_frame {{
                    -pdf-frame-content: footerContent;
                    bottom: 1cm;
                    margin-left: 2cm;
                    margin-right: 2cm;
                    height: 1cm;
                }}
            }}
            body {{
                font-family: Helvetica, Arial, sans-serif;
                font-size: 10pt;
                line-height: 1.5;
                color: #333;
            }}
            .header {{
                text-align: left;
                margin-bottom: 2cm;
                border-bottom: 2px solid #3366cc;
                padding-bottom: 10px;
            }}
            .header h1 {{
                font-size: 18pt;
                color: #3366cc;
                margin: 0;
                font-family: 'Roboto', sans-serif;
            }}
            .header p {{
                margin: 2px 0;
                font-size: 10pt;
                color: #666;
            }}
            .title {{
                text-align: center;
                margin-bottom: 1cm;
            }}
            .title h2 {{
                font-size: 16pt;
                text-transform: uppercase;
                margin: 0;
            }}
            .section {{
                margin-bottom: 1cm;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 1cm;
            }}
            th {{
                background-color: #f0f4f8;
                color: #333;
                font-weight: bold;
                padding: 8px;
                text-align: left;
                border: 1px solid #ddd;
                font-size: 9pt;
            }}
            td {{
                padding: 8px;
                border: 1px solid #ddd;
                font-size: 9pt;
                vertical-align: top;
            }}
            .amount {{
                text-align: right;
                font-family: monospace;
            }}
            .excluded {{
                background-color: #fff4e5; /* Light orange for excluded */
                color: #d97706; /* Darker orange text */
            }}
            .note {{
                font-style: italic;
                font-size: 8pt;
                color: #666;
                margin-top: 4px;
            }}
            .summary-box {{
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                padding: 15px;
                border-radius: 5px;
            }}
            .total-row td {{
                font-weight: bold;
                background-color: #f0f4f8;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{posd_data.name}</h1>
            <p>{posd_data.address}</p>
            <p>OIB: {posd_data.oib}</p>
        </div>

        <div class="title">
            <h2>Obrazloženje Uz PO-SD Obrazac</h2>
            <p>Za razdoblje: 01.01.{year}. - 31.12.{year}.</p>
        </div>

        <div class="section">
            <p>
                Ovaj dokument služi kao prilog PO-SD obrascu i detaljno prikazuje sve evidentirane priljeve
                na žiro računu te specificira koji su priljevi uključeni u oporezive primitke, a koji su izuzeti
                uz pripadajuće obrazloženje.
            </p>
        </div>

        <div class="section">
            <h3>Specifikacija Prometa po Žiro Računu</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 15%;">Datum</th>
                        <th style="width: 35%;">Opis Plaćanja</th>
                        <th style="width: 25%;">Napomena / Status</th>
                        <th style="width: 25%; text-align: right;">Iznos</th>
                    </tr>
                </thead>
                <tbody>
    """

    total_all = 0.0
    total_posd = 0.0
    total_excluded = 0.0

    for tx in year_txs:
        total_all += tx.amount
        is_excluded = getattr(tx, 'is_excluded_from_posd', False)
        
        row_class = 'class="excluded"' if is_excluded else ''
        status_text = "<strong>ISKLJUČENO</strong>" if is_excluded else "PO-SD Prihod"
        
        note = getattr(tx, 'posd_note', '') or ''
        if note:
             status_text += f"<br/><span class='note'>{note}</span>"
        elif is_excluded:
             status_text += f"<br/><span class='note'>Nije poslovni primitak</span>"

        if is_excluded:
            total_excluded += tx.amount
        else:
            total_posd += tx.amount

        html_content += f"""
                    <tr {row_class}>
                        <td>{tx.date.strftime('%d.%m.%Y.')}</td>
                        <td>{tx.description}</td>
                        <td>{status_text}</td>
                        <td class="amount">{tx.amount:.2f} {tx.currency}</td>
                    </tr>
        """

    html_content += f"""
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">UKUPNO PROMET:</td>
                        <td class="amount">{total_all:.2f} EUR</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right;">UKUPNO IZUZETO:</td>
                        <td class="amount">-{total_excluded:.2f} EUR</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right; color: #10b981;">PO-SD OSNOVICA:</td>
                        <td class="amount" style="color: #10b981;">{total_posd:.2f} EUR</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="section summary-box">
             <h3>Zaključak</h3>
             <p>
                Temeljem gornje specifikacije, u obrazac PO-SD za {year}. godinu unosi se ukupni iznos
                oporezivih primitaka od <strong>{total_posd:.2f} EUR</strong>.
             </p>
        </div>

        <div id="footerContent">
            DIREKTOR / VLASNIK: {posd_data.name} | Datum: {formatted_date}
        </div>
    </body>
    </html>
    """
    
    output_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=output_buffer)
    
    if pisa_status.err:
        raise Exception("Error generating PDF memorandum")
        
    return output_buffer.getvalue()

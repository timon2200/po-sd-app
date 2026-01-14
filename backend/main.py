from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import os
import sys
from datetime import datetime

from backend.models import Transaction, TransactionType, TransactionCategory, POSDData, Settings, Client, Invoice, InvoiceStatus
from backend.database import XMLDatabase
from backend.erste_parser import parse_erste_html
from backend.gmail_service import GmailService
from backend.xml_generator import generate_posd_xml
from backend.sudreg import SudregAPI
from backend.vies import ViesAPI
from backend.barcode_utils import generate_epc_qr_code
from backend.memorandum_generator import generate_memorandum_pdf
from fastapi.responses import Response
from pypdf import PdfWriter
from pypdf import PdfWriter
import io
import json

app = FastAPI(title="PO-SD App API")

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration defaults
DATA_DIR = os.path.abspath("data")
DB_PATH = os.path.join(DATA_DIR, "transactions.xml")
CREDENTIALS_PATH = os.path.join(os.getcwd(), "credentials.json")
TOKEN_PATH = os.path.join(DATA_DIR, "token.json")

# Initialize DB
db = XMLDatabase(DB_PATH)
gmail_service = GmailService(CREDENTIALS_PATH, TOKEN_PATH)

# Initialize Sudreg API
SUDREG_CREDS_PATH = os.path.join(os.getcwd(), "backend", "sudreg_credentials.json")
if not os.path.exists(SUDREG_CREDS_PATH):
    # Fallback to root if not in backend/
    SUDREG_CREDS_PATH = os.path.join(os.getcwd(), "sudreg_credentials.json")

sudreg_api = None
if os.path.exists(SUDREG_CREDS_PATH):
    try:
        with open(SUDREG_CREDS_PATH, 'r') as f:
            creds = json.load(f)
            sudreg_api = SudregAPI(creds["client_id"], creds["client_secret"])
    except Exception as e:
        print(f"Failed to init Sudreg API: {e}")

# Initialize VIES API (No credentials needed)
vies_api = ViesAPI()


# Sync Manager for SSE
import asyncio
from sse_starlette.sse import EventSourceResponse

class SyncManager:
    def __init__(self):
        self.status = "idle" # idle, running, completed, error
        self.logs = []
        self.progress = 0
        self.total = 0
        self.listeners = []

    def reset(self):
        self.status = "idle"
        self.logs = []
        self.progress = 0
        self.total = 0
        self._notify()

    def add_log(self, message: str):
        self.logs.append({"timestamp": datetime.now().isoformat(), "message": message})
        self._notify()

    def set_status(self, status: str):
        self.status = status
        self._notify()
    
    def update_progress(self, current: int, total: int):
        self.progress = current
        self.total = total
        self._notify()

    def _notify(self):
        # In a real async scenario we might queue this
        pass

    async def event_generator(self):
        while True:
            # Yield current state
            data = {
                "status": self.status,
                "logs": self.logs,
                "progress": self.progress,
                "total": self.total
            }
            yield {"data": json.dumps(data)}
            await asyncio.sleep(1) # Simple polling for now, or use a queue/event

sync_manager = SyncManager()
import json

@app.get("/api/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=-1),
    search: Optional[str] = None,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    type: Optional[str] = Query(None, description="Transaction type (inflow/outflow)")
):
    start = None
    end = None
    if start_date:
        try:
             start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
             pass
    if end_date:
        try:
             end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
             pass

    result = db.load_transactions_paginated(
        skip=(page - 1) * limit,
        limit=limit,
        search=search,
        start_date=start,
        end_date=end,
        type=TransactionType(type) if type else None
    )
    
    return result

@app.get("/api/documents/{filename}")
def get_document(filename: str):
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    from fastapi.responses import FileResponse
    return FileResponse(file_path)

@app.post("/api/transactions/sync-local")
def sync_local_file(file_path: str):
    if not os.path.exists(file_path):
         raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        filename = os.path.basename(file_path)
        new_txs, metadata = parse_erste_html(content, source_filename=filename)
        added_count = db.save_transactions(new_txs)
        db.save_metadata(metadata)
        return {"status": "success", "added": added_count, "metadata_found": bool(metadata), "total_found": len(new_txs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions/upload")
async def upload_transactions(files: List[UploadFile]):
    total_added = 0
    total_found = 0
    results = []

    for file in files:
        try:
            content = await file.read()
            # Decode using utf-8, assuming Erste export is utf-8
            html_content = content.decode('utf-8')
            new_txs, metadata = parse_erste_html(html_content, source_filename=file.filename)
            added = db.save_transactions(new_txs)
            db.save_metadata(metadata)
            
            # Save the file to DATA_DIR so we can serve it later
            save_path = os.path.join(DATA_DIR, file.filename)
            with open(save_path, "wb") as f:
                f.write(content)
            db.mark_file_processed(file.filename)
            
            total_added += added
            total_found += len(new_txs)
            
            results.append({
                "filename": file.filename,
                "status": "success",
                "added": added,
                "found": len(new_txs)
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
    
    return {
        "summary": {
            "total_added": total_added,
            "total_found": total_found
        },
        "details": results
    }

class MergeRequest(BaseModel):
    filenames: List[str]

from xhtml2pdf import pisa

@app.post("/api/documents/merge")
def merge_documents(req: MergeRequest):
    print(f"Received merge request for {len(req.filenames)} files")
    merger = PdfWriter()
    found_any = False
    
    # Create temp directory for PDFs if not exists
    temp_pdf_dir = os.path.join(DATA_DIR, "temp_pdfs")
    os.makedirs(temp_pdf_dir, exist_ok=True)
    
    generated_temp_files = []
    import subprocess
    import uuid

    for filename in req.filenames:
        file_path = os.path.join(DATA_DIR, filename)
        if os.path.exists(file_path):
            try:
                # Generate unique temp PDF path
                temp_pdf_path = os.path.join(temp_pdf_dir, f"{uuid.uuid4()}.pdf")
                worker_path = os.path.join(os.path.dirname(__file__), "pdf_worker.py")
                
                # Call worker
                print(f"Converting {filename} to PDF via worker...")
                result = subprocess.run(
                    [sys.executable, worker_path, file_path, temp_pdf_path],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                     print(f"Worker failed for {filename}: {result.stderr}")
                     continue
                
                print(f"Worker success for {filename}")
                generated_temp_files.append(temp_pdf_path)
                
                # Append to merger
                merger.append(temp_pdf_path)
                found_any = True
            except Exception as e:
                print(f"Error merging {filename}: {e}")
    
    if not found_any:
        raise HTTPException(status_code=404, detail="No valid documents found to merge")
        
    output = io.BytesIO()
    merger.write(output)
    merger.close()
    output.seek(0)
    
    # Cleanup temp files
    for tmp in generated_temp_files:
        try:
            os.remove(tmp)
        except:
            pass
    try:
        os.rmdir(temp_pdf_dir)
    except:
        pass
    
    return Response(
        content=output.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=merged_transactions.pdf"}
    )

class PaymentValues(BaseModel):
    iban: str
    amount: float
    payee_name: str
    payment_reference: str # includes model e.g. HR00 1234
    description: Optional[str] = ""
    purpose_code: Optional[str] = "COST"

@app.post("/api/utils/generate-payment-code")
def generate_payment_code_endpoint(data: PaymentValues):
    try:
        # Strip spaces from Ref
        ref = data.payment_reference.replace(" ", "")
        
        qr_b64 = generate_epc_qr_code(
            iban=data.iban,
            amount=data.amount,
            payee_name=data.payee_name,
            payment_reference=ref,
            description=data.description,
            purpose_code=data.purpose_code
        )
        return {"qr_code": qr_b64}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class HTMLToPDFRequest(BaseModel):
    html_content: str
    filename: Optional[str] = "document"

@app.post("/api/documents/html-to-pdf")
def html_to_pdf(req: HTMLToPDFRequest):
    # Reuse pdf_worker logic but via subprocess or direct import?
    # Since pdf_worker uses sys.argv, direct import of pisa is better here if thread-safe
    # or just write temp file and call subprocess to keep it isolated (some libs have global state)
    
    # Let's try direct usage first, catching exceptions
    try:
        from xhtml2pdf import pisa
        output_buffer = io.BytesIO()
        
        # pisa.CreatePDF expects str or file-like
        # Warning: pisa might not support all modern CSS.
        pisa_status = pisa.CreatePDF(req.html_content, dest=output_buffer)
        
        if pisa_status.err:
             raise Exception("PDF generation error")
             
        output_buffer.seek(0)
        return Response(
            content=output_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={req.filename}.pdf"}
        )
    except Exception as e:
         print(f"Error producing PDF: {e}")
         raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/posd-stats", response_model=POSDData)
def get_posd_stats(year: int = datetime.now().year):
    txs = db.load_transactions()
    metadata = db.get_metadata()
    
    # Calculate calculated values
    total_receipts = 0.0
    tax_paid = 0.0
    surtax_paid = 0.0
    
    for tx in txs:
        if tx.date.year == year:
            # Skip if manually excluded
            if getattr(tx, 'is_excluded_from_posd', False):
                continue
                
            if tx.category == TransactionCategory.BUSINESS_INCOME:
                total_receipts += tx.amount
            

    # Calculate tax paid using robust logic
    from backend.posd_logic import get_tax_bracket, calculate_paid_tax, PAUSAL_TIERS_2025, PAUSAL_TIERS_2024
    tax_paid, surtax_paid = calculate_paid_tax(txs, year)

    # Calculate bracket
    bracket = get_tax_bracket(total_receipts, year=year)
    
    # Get all tiers for the year
    all_tiers = PAUSAL_TIERS_2025 if year >= 2025 else PAUSAL_TIERS_2024

    return POSDData(
        oib=metadata.get("oib", "58278708852"), 
        name=metadata.get("name", "Lotus RC, vl. Timon Terzić"), 
        address=metadata.get("address", "STANKA VRAZA 10, 42000 VARAŽDIN"),
        # name and address use defaults from model
        year=year,
        total_receipts=total_receipts,
        tax_paid=tax_paid,
        surtax_paid=surtax_paid,
        tax_bracket=bracket.description if bracket else "Van sustava (preko 40k/60k)",
        base_tax_liability=bracket.base_tax_liability if bracket else 0.0,
        all_brackets=all_tiers
    )

@app.post("/api/posd/xml")
def generate_posd_xml_post(data: POSDData):
    xml_content = generate_posd_xml(data)
    
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=PO-SD_{data.year}.xml"}
    )

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=PO-SD_{year}.xml"}
    )

@app.get("/api/posd/memorandum")
def get_posd_memorandum(year: int = datetime.now().year):
    txs = db.load_transactions()
    stats = get_posd_stats(year) # Re-use logic to get headers/metadata
    
    # Generate PDF
    pdf_content = generate_memorandum_pdf(stats, txs, year)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=PO-SD_Obrazlozenje_{year}.pdf"}
    )

class ReviewRequestItem(BaseModel):
    id: str
    is_excluded: Optional[bool] = None
    note: Optional[str] = None
    tax_type: Optional[str] = None # 'tax', 'surtax', or '' (empty) to clear

class ReviewRequest(BaseModel):
    items: List[ReviewRequestItem]

@app.post("/api/transactions/review")
def review_transactions(req: ReviewRequest):
    txs = db.load_transactions()
    existing_map = {tx.id: tx for tx in txs}
    
    updated_count = 0
    for item in req.items:
        if item.id in existing_map:
            tx = existing_map[item.id]
            # Only update if changed
            changed = False
            
            if item.is_excluded is not None and getattr(tx, 'is_excluded_from_posd', False) != item.is_excluded:
                tx.is_excluded_from_posd = item.is_excluded
                changed = True
            
            if item.note is not None and getattr(tx, 'posd_note', None) != item.note:
                tx.posd_note = item.note
                changed = True
                
            if item.tax_type is not None:
                new_tax_type = item.tax_type if item.tax_type else None
                if getattr(tx, 'tax_type', None) != new_tax_type:
                    tx.tax_type = new_tax_type
                    changed = True
            
            if changed:
                updated_count += 1
    
    if updated_count > 0:
        db.save_transactions(txs)
        
    return {"status": "success", "updated": updated_count}

@app.get("/api/settings")
def get_settings():
    return {
        "xml_path": DB_PATH,
        "google_auth_status": "Authenticated" if os.path.exists(TOKEN_PATH) else "Not Authenticated",
        "credentials_present": os.path.exists(CREDENTIALS_PATH)
    }

@app.post("/api/auth/google")
def authenticate_google():
    success = gmail_service.authenticate()
    if not success:
        raise HTTPException(status_code=400, detail="Authentication failed or credentials missing")
    return {"status": "success"}

@app.get("/api/auth/me")
def get_current_user():
    email = gmail_service.get_profile_email()
    return {
        "authenticated": email is not None,
        "email": email
    }

    success = gmail_service.logout()
    return {"status": "success" if success else "error"}

@app.get("/api/issuer")
def get_issuer_info():
    """Returns the issuer (my business) details for invoices."""
    metadata = db.get_metadata()
    return {
        "name": metadata.get("name", "Lotus RC, vl. Timon Terzić"),
        "address": metadata.get("address", "STANKA VRAZA 10, 42000 VARAŽDIN"),
        "oib": metadata.get("oib", "58278708852"),
        "iban": metadata.get("iban", "HR9824020061140483524")
    }

# --- Client Management Endpoints ---

@app.get("/api/clients", response_model=List[Client])
def get_clients():
    return db.get_clients()

@app.post("/api/clients", response_model=Client)
def save_client(client: Client):
    return db.save_client(client)

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str):
    success = db.delete_client(client_id)
    if not success:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"status": "success"}


# --- Invoice Management Endpoints ---

@app.get("/api/invoices", response_model=dict)
def get_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=-1),
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None
):
    start = None
    end = None
    if start_date:
        try:
             start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
             pass
    if end_date:
        try:
             end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
             pass

    status_enum = None
    if status and status != "":
        try:
            status_enum = InvoiceStatus(status)
        except:
             pass

    result = db.get_invoices(
        skip=(page - 1) * limit if limit != -1 else 0,
        limit=limit,
        search=search,
        start_date=start,
        end_date=end,
        status=status_enum
    )
    return result

@app.post("/api/invoices", response_model=Invoice)
def create_invoice(invoice: Invoice):
    # Determine year from date if not correct
    invoice.year = invoice.issue_date.year
    saved = db.save_invoice(invoice)
    return saved

@app.get("/api/invoices/stats")
def get_invoice_stats(year: int = datetime.now().year):
    return db.get_invoice_stats(year)

@app.get("/api/invoices/{invoice_id}", response_model=Invoice)
def get_invoice(invoice_id: str):
    inv = db.get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv

@app.delete("/api/invoices/{invoice_id}")
def delete_invoice(invoice_id: str):
    success = db.delete_invoice(invoice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"status": "success"}

# --- Sudreg API Endpoints ---

@app.get("/api/sudreg/search")
def search_sudreg(name: str):
    # Sudreg search by name only works if API is configured
    if sudreg_api:
        try:
            results = sudreg_api.search_by_name(name)
            mapped = [sudreg_api.map_to_client(r) for r in results]
            return mapped
        except Exception as e:
            print(f"Sudreg search error: {e}")
            # Fallthrough to emptiness
            
    return []

@app.get("/api/sudreg/details")
def get_sudreg_details(oib: str):
    # Try Sudreg first
    if sudreg_api:
        try:
            details = sudreg_api.get_details_by_oib(oib)
            if details:
                client = sudreg_api.map_to_client(details)
                return client
        except Exception as e:
            print(f"Sudreg details error: {e}")
            
    # Fallback to VIES
    if vies_api:
        try:
            details = vies_api.get_details_by_oib(oib)
            if details:
                client = vies_api.map_to_client(details)
                return client
        except Exception as e:
            print(f"VIES details error: {e}")

    raise HTTPException(status_code=404, detail="Subject not found in registers")

@app.get("/api/sync/events")
async def sync_events():
    return EventSourceResponse(sync_manager.event_generator())

@app.post("/api/sync/gmail")
def sync_gmail(background_tasks: BackgroundTasks, query: Optional[str] = None):
    """
    Triggers a background task to fetch emails and parse them.
    """
    if sync_manager.status == "running":
         return {"status": "already_running"}
    
    sync_manager.reset()
    sync_manager.set_status("running")
    background_tasks.add_task(run_gmail_sync, query)
    return {"status": "started"}

def run_gmail_sync(query: Optional[str] = None):
    print("Starting Gmail sync...")
    sync_manager.add_log("Starting Gmail sync...")
    
    try:
        # Fetching all emails now, thanks to pagination in gmail_service
        # Use provided query or let fetch_erste_emails use its default
        if query:
            messages = gmail_service.fetch_erste_emails(query=query)
        else:
            messages = gmail_service.fetch_erste_emails()
        count_emails = len(messages)
        print(f"Found {count_emails} emails.")
        sync_manager.add_log(f"Found {count_emails} emails.")
        
        sync_manager.update_progress(0, count_emails)
        
        count = 0
        skipped = 0
        
        for i, msg in enumerate(messages):
            # Check if we already have the filename without downloading?
            # Gmail API message list doesn't give filename, we need to get details.
            # Ideally we'd get message details and check filename before download.
            # But download_attachment already gets details.
            
            # Optimization: We can't know filename without fetching message details. 
            # But we can assume download_attachment returns the path, and we can check db after saving?
            # Or better: modify download_attachment to return filename before saving? 
            # For now, let's keep it simple: download, check filename, if processed -> delete and skip.
            # Wait, user wants to avoid re-processing.
            
            # Let's see if we can optimize. run_gmail_sync calls download_attachment.
            # We can check if file exists in processed_files before parsing.
            
            sync_manager.add_log(f"Processing email {i+1}/{count_emails}...")
            
            # We will download it (it's fast enough for text files) then check processing status
            # Ideally we would check 'HistoryId' or something, but filename is what we have.
            
            save_path = gmail_service.download_attachment(msg['id'], DATA_DIR)
            
            if save_path:
                filename = os.path.basename(save_path)
                
                if db.is_file_processed(filename):
                     sync_manager.add_log(f"Skipping {filename} (already processed)")
                     # We used to delete here, but now we keep it for PDF generation
                     # If it's already there, great. If we just downloaded it, also great.
                     skipped += 1
                     sync_manager.update_progress(i + 1, count_emails)
                     continue

                try:
                    with open(save_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    new_txs, metadata = parse_erste_html(content, source_filename=filename)
                    db.save_transactions(new_txs)
                    db.save_metadata(metadata)
                    db.mark_file_processed(filename)
                    count += 1
                    sync_manager.add_log(f"Successfully processed {filename}")
                except Exception as e:
                    print(f"Failed to parse {save_path}: {e}")
                    sync_manager.add_log(f"Error parsing {save_path}: {e}")
            else:
                 sync_manager.add_log(f"No target attachment for email {msg['id']}")
            
            sync_manager.update_progress(i + 1, count_emails)
        
        print(f"Gmail sync completed. Processed {count} new attachments. Skipped {skipped}.")
        sync_manager.add_log(f"Gmail sync completed. Processed {count} new attachments. Skipped {skipped}.")
        sync_manager.set_status("completed")

    except Exception as e:
        print(f"Sync failed: {e}")
        sync_manager.add_log(f"Sync failed: {e}")
        sync_manager.set_status("error")

if __name__ == "__main__":
    import uvicorn
    # Use import string for reload to work
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

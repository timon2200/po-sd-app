# PO-SD App

A full-stack accounting & invoicing application for Croatian sole proprietors (Obrt). Automates PO-SD tax form preparation, invoice generation, bank statement processing, and client management.

## Features

- **📊 Transaction Dashboard** – View, filter, and manage all business transactions with charts and analytics
- **🧙 PO-SD Wizard** – Step-by-step guide to prepare the annual PO-SD tax form with automatic XML generation
- **🧾 Invoice Generator** – Create professional PDF invoices with QR payment codes (Slikaj i plati), EU VAT (VIES) validation, and customizable templates
- **📋 Invoice Dashboard** – Browse, edit, duplicate, and manage all issued invoices
- **📧 Gmail Integration** – Automatically fetch and parse Erste bank statements from email
- **⚙️ Settings** – Configure business details (Obrt data), bank info, and issuer profiles

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS 4, Recharts, Lucide |
| Backend  | Python, FastAPI, Uvicorn                        |
| PDF      | xhtml2pdf, custom font support (Times New Roman, DejaVu) |
| Data     | JSON file storage (`data/`)                     |
| QR Codes | Segno (HUB3 barcode for Croatian banking)       |
| VAT      | VIES EU VAT number validation                   |

## Project Structure

```
po-sd-app/
├── backend/
│   ├── main.py                  # FastAPI server & API routes
│   ├── database.py              # JSON-based data layer
│   ├── invoice_pdf_generator.py # PDF invoice rendering
│   ├── memorandum_generator.py  # Memorandum PDF generation
│   ├── xml_generator.py         # PO-SD XML export
│   ├── gmail_service.py         # Gmail API integration
│   ├── erste_parser.py          # Erste bank HTML statement parser
│   ├── barcode_utils.py         # HUB3 QR code generation
│   ├── vies.py                  # EU VAT (VIES) validation
│   ├── posd_logic.py            # PO-SD calculation logic
│   ├── fonts/                   # Embedded fonts for PDF generation
│   └── assets/                  # Invoice template decorative assets
├── frontend/
│   └── src/
│       ├── App.jsx              # Main app with sidebar navigation
│       └── components/
│           ├── Dashboard.jsx        # Transaction overview & charts
│           ├── Wizard.jsx           # PO-SD form wizard
│           ├── InvoiceGenerator.jsx # Invoice creation/editing form
│           ├── InvoiceDashboard.jsx # Invoice list & management
│           ├── ClientSelector.jsx   # Client lookup with VAT validation
│           ├── Settings.jsx         # Business configuration
│           └── SyncStatus.jsx       # Gmail sync indicator
├── data/                        # JSON data storage
└── scripts/                     # Utility scripts
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the API on `http://localhost:8000`.

## Recent Updates

- **Invoice PDF Redesign** – Completely rebuilt invoice PDF layout with proper font embedding (Times New Roman, DejaVu Serif), decorative borders, and professional formatting
- **Slikaj i plati QR** – Added HUB3 QR payment codes to invoices for instant bank transfers
- **Invoice Dashboard** – New dedicated view for browsing, editing, and duplicating invoices
- **Dynamic Issuer Data** – Invoice generator now pulls business data from settings
- **E-Invoice & Fiscalization** – Initial module scaffolding for future e-invoice (eRačun) and fiscalization support
- **VIES VAT Validation** – Enhanced EU VAT number lookup with better error handling
- **XML Generator Improvements** – Updated PO-SD XML export with corrected field mappings
- **Gmail Sync Fixes** – Improved Erste bank statement parsing and font encoding for memorandum PDFs

## License

Private – All rights reserved.

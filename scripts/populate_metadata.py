import sys
import os
# Add project root to path
sys.path.append("/Users/timonterzic/Documents/po-sd-app")
from backend.database import XMLDatabase
from backend.erste_parser import parse_erste_html

db_path = "/Users/timonterzic/Documents/po-sd-app/data/transactions.xml"
db = XMLDatabase(db_path)
file_path = "/Users/timonterzic/Documents/po-sd-app/IZV_2025_07_18 03_54_53_727_29.html"

print(f"Reading {file_path}...")
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

txs, meta = parse_erste_html(content)
print("Metadata extracted:", meta)

if meta:
    db.save_metadata(meta)
    print("Metadata saved to database.")
    
    # Verify load
    loaded = db.get_metadata()
    print("Metadata in DB:", loaded)
else:
    print("No metadata found.")

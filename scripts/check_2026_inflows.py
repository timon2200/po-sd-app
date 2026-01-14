import xml.etree.ElementTree as ET
from datetime import datetime

DB_PATH = '/Users/timonterzic/Documents/po-sd-app/data/transactions.xml'

def check_2026_inflows():
    try:
        tree = ET.parse(DB_PATH)
        root = tree.getroot()
        tx_root = root.find("transactions")
        
        inflows_2026 = []
        
        for tx in tx_root.findall("transaction"):
            date_str = tx.find("date").text
            type_str = tx.find("type").text
            
            if date_str.startswith("2026") and type_str == "inflow":
                amount = tx.find("amount").text
                desc = tx.find("description").text
                inflows_2026.append({
                    "date": date_str,
                    "amount": amount,
                    "description": desc
                })
        
        print(f"Found {len(inflows_2026)} inflows in 2026.")
        for tx in inflows_2026:
            print(f"- {tx['date']}: {tx['amount']} EUR - {tx['description']}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_2026_inflows()

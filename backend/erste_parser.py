import re
from datetime import datetime
from bs4 import BeautifulSoup
from typing import List
import hashlib
from backend.models import Transaction, TransactionType, TransactionCategory

def parse_erste_html(html_content: str, source_filename: str = None) -> List[Transaction]:
    """
    Parses an Erste Bank HTML statement and returns a list of Transactions.
    """

    soup = BeautifulSoup(html_content, 'lxml') # using lxml for better speed/lenient parsing

    transactions = []
    metadata = {}
    
    # Extract Metadata (OIB, Name, Address)
    try:
        # OIB
        # Finding div with text "OIB:" then getting the sibling or finding by structure
        # Structure: div > span(OIB:) ... span(Value)
        oib_label = soup.find('span', string=re.compile(r'\s*OIB:\s*'))
        if oib_label:
            # The value is usually in the last span of that parent div
            oib_val_span = oib_label.find_parent('div').find_all('span')[-1]
            if oib_val_span:
                metadata['oib'] = oib_val_span.get_text(strip=True)

        # Name
        name_label = soup.find('span', string=re.compile(r'\s*Naziv klijenta:\s*'))
        if name_label:
            name_val_span = name_label.find_parent('div').find_all('span')[-1]
            if name_val_span:
                metadata['name'] = name_val_span.get_text(strip=True)

        # Address - Located in #Right #Generalno
        right_div = soup.find('div', id='Right')
        if right_div:
            gen_div = right_div.find('div', id='Generalno')
            if gen_div:
                # Text usually like: Name <br> Address Line 1 <br> City ...
                # We can try to get the text parts
                text_content = gen_div.get_text(separator="|", strip=True)
                parts = text_content.split('|')
                # Heuristic: Name is usually first, Address follows
                if len(parts) > 1:
                    # e.g. "Lotus RC...", "STANKA VRAZA 10", "42000 VARAŽDIN"
                    # Join parts 1 and 2 for address
                    metadata['address'] = ", ".join(parts[1:3]) 
    except Exception as e:
        print(f"Error extracting metadata: {e}")

    # Locate the transaction table. 
    # Based on the file viewing, rows have class "trItems"
    rows = soup.find_all('tr', class_='trItems')

    for row in rows:
        cells = row.find_all('td')
        if not cells or len(cells) < 6:
            continue

        # Extract Date (Format: 19.12.2025.)
        # Cell 0 contains dates (execution and value date), we take the first one
        date_text = cells[0].get_text(separator="|").split('|')[0].strip()
        try:
            tx_date = datetime.strptime(date_text, '%d.%m.%Y.').date()
        except ValueError:
            print(f"Skipping row with invalid date: {date_text}")
            continue

        # Extract Description
        # Cell 1 contains description details
        description = cells[1].get_text(separator=" ").strip()
        description = " ".join(description.split()) # clean extra spaces

        # Extract Reference
        # Cell 3 contains reference numbers
        if len(cells) > 3:
            reference = cells[3].get_text(separator=" ").strip().replace("\n", " ")
        else:
            reference = ""

        # Extract Amount
        # Cell 4 is outflow, Cell 5 is inflow (based on header analysis in file outline)
        # Header: ... | Isplata | Uplata
        outflow_text = cells[4].get_text(strip=True) if len(cells) > 4 else ""
        inflow_text = cells[5].get_text(strip=True) if len(cells) > 5 else ""

        amount = 0.0
        tx_type = TransactionType.OUTFLOW
        category = TransactionCategory.OTHER

        if inflow_text and inflow_text != '&nbsp;':
             # Parse inflow
             amount_str = inflow_text.replace('.', '').replace(',', '.')
             amount = float(amount_str)
             tx_type = TransactionType.INFLOW
             category = TransactionCategory.BUSINESS_INCOME # Default for positive
        elif outflow_text and outflow_text != '&nbsp;':
            # Parse outflow
            amount_str = outflow_text.replace('.', '').replace(',', '.')
            amount = float(amount_str)
            tx_type = TransactionType.OUTFLOW
            category = TransactionCategory.BUSINESS_EXPENSE
        else:
            # Skip empty rows or headers if any sneak in
            continue

        # Generate a unique ID based on fields to avoid duplicates
        unique_str = f"{tx_date}{description}{amount}{reference}"
        tx_id = hashlib.md5(unique_str.encode()).hexdigest()

        tx = Transaction(
            id=tx_id,
            date=tx_date,
            description=description,
            amount=amount,
            type=tx_type,
            category=category,
            raw_reference=reference,
            source_file=source_filename
        )
        transactions.append(tx)

    return transactions, metadata

if __name__ == "__main__":
    # Test run
    import sys
    if len(sys.argv) > 1:
        fpath = sys.argv[1]
        print(f"Parsing {fpath}...")
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        txs, meta = parse_erste_html(content)
        print(f"Metadata: {meta}")
        print(f"Found {len(txs)} transactions.")
        for t in txs:
            print(f"{t.date} | {t.amount} | {t.type} | {t.description[:50]}...")

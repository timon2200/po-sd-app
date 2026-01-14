import os
import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import List, Optional
import json
from backend.models import Transaction, TransactionType, TransactionCategory, Client
from datetime import date
import uuid

class XMLDatabase:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.processed_files_path = os.path.join(os.path.dirname(db_path), "processed_files.json")
        self._ensure_db_exists()
        self.processed_files = self._load_processed_files()

    def _ensure_db_exists(self):
        if not os.path.exists(self.db_path):
            root = ET.Element("database")
            transactions = ET.SubElement(root, "transactions")
            tree = ET.ElementTree(root)
            self._save_tree(tree)
            
        if not os.path.exists(self.processed_files_path):
            with open(self.processed_files_path, 'w') as f:
                json.dump([], f)

    def _load_processed_files(self) -> set:
        try:
            with open(self.processed_files_path, 'r') as f:
                return set(json.load(f))
        except:
            return set()

    def save_processed_files(self):
        with open(self.processed_files_path, 'w') as f:
            json.dump(list(self.processed_files), f, indent=2)

    def is_file_processed(self, filename: str) -> bool:
        return filename in self.processed_files

    def mark_file_processed(self, filename: str):
        self.processed_files.add(filename)
        self.save_processed_files()

    def _save_tree(self, tree: ET.ElementTree):
        # Pretty print for readability
        xmlstr = minidom.parseString(ET.tostring(tree.getroot())).toprettyxml(indent="    ")
        # Remove empty lines caused by pretty print sometimes
        xmlstr = "\n".join([line for line in xmlstr.split('\n') if line.strip()])
        
        with open(self.db_path, "w", encoding="utf-8") as f:
            f.write(xmlstr)

    def load_transactions(self) -> List[Transaction]:
        if not os.path.exists(self.db_path):
            return []

        tree = ET.parse(self.db_path)
        root = tree.getroot()
        transactions = []
        
        tx_root = root.find("transactions")
        if tx_root is None:
            return []

        for tx_node in tx_root.findall("transaction"):
            try:
                tx = Transaction(
                    id=tx_node.get("id"),
                    date=tx_node.find("date").text,
                    description=tx_node.find("description").text,
                    amount=float(tx_node.find("amount").text),
                    currency=tx_node.find("currency").text,
                    type=TransactionType(tx_node.find("type").text),
                    category=TransactionCategory(tx_node.find("category").text),

                    raw_reference=tx_node.find("raw_reference").text if tx_node.find("raw_reference") is not None else None,
                    source_file=tx_node.find("source_file").text if tx_node.find("source_file") is not None else None
                )
                transactions.append(tx)
            except Exception as e:
                print(f"Error loading transaction: {e}")
                continue
        
        return transactions

    def load_transactions_paginated(
        self, 
        skip: int = 0, 
        limit: int = 100, 
        search: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        type: Optional[TransactionType] = None
    ) -> dict:
        """
        Loads transactions with filtering, search, and pagination.
        Using native XML parsing might be slow for huge files, but for 10k it should be fine.
        For production with 100k+, we would move to SQLite.
        """
        all_txs = self.load_transactions() # In-memory implementation for now
        
        # Sort by date desc
        all_txs.sort(key=lambda x: x.date, reverse=True)
        
        filtered = []
        for tx in all_txs:
            # Type filter
            if type and tx.type != type:
                continue
                
            # Date filter
            if start_date and tx.date < start_date:
                continue
            if end_date and tx.date > end_date:
                continue
                
            # Search filter (description or amount)
            if search:
                search_lower = search.lower()
                if (search_lower not in tx.description.lower() and 
                    search_lower not in str(tx.amount)):
                    continue
            
            filtered.append(tx)
            
        total = len(filtered)
        if limit == -1:
            paginated = filtered
        else:
            paginated = filtered[skip : skip + limit]
        
        return {
            "total": total,
            "data": paginated,
            "skip": skip,
            "limit": limit
        }

    def save_transactions(self, new_transactions: List[Transaction]) -> int:
        """
        Saves a list of transactions to the XML DB. Skips duplicates based on ID.
        Updates source_file if missing in existing transaction.
        Returns the number of new or updated transactions.
        """
        tree = ET.parse(self.db_path)
        root = tree.getroot()
        tx_root = root.find("transactions")
        
        # Build index of existing elements
        existing_map = {e.get("id"): e for e in tx_root.findall("transaction")}
        
        added_count = 0

        for tx in new_transactions:
            if tx.id in existing_map:
                # Check if we need to update source_file
                if tx.source_file:
                    existing_elem = existing_map[tx.id]
                    sf_node = existing_elem.find("source_file")
                    if sf_node is None:
                        ET.SubElement(existing_elem, "source_file").text = tx.source_file
                        added_count += 1
                continue

            # Create new transaction element
            tx_elem = ET.SubElement(tx_root, "transaction", id=tx.id)
            
            ET.SubElement(tx_elem, "date").text = tx.date.isoformat()
            ET.SubElement(tx_elem, "description").text = tx.description
            ET.SubElement(tx_elem, "amount").text = str(tx.amount)
            ET.SubElement(tx_elem, "currency").text = tx.currency
            ET.SubElement(tx_elem, "type").text = tx.type.value
            ET.SubElement(tx_elem, "category").text = tx.category.value
            if tx.raw_reference:
                ET.SubElement(tx_elem, "raw_reference").text = tx.raw_reference
            if tx.source_file:
                ET.SubElement(tx_elem, "source_file").text = tx.source_file

            added_count += 1
            existing_map[tx.id] = tx_elem

        if added_count > 0:
            self._save_tree(tree)
        
        return added_count

    def save_metadata(self, metadata: dict):
        """
        Updates metadata section in XML.
        """
        tree = ET.parse(self.db_path)
        root = tree.getroot()
        
        meta_node = root.find("metadata")
        if meta_node is None:
            meta_node = ET.SubElement(root, "metadata")
            
        for key, value in metadata.items():
            if not value: continue
            
            node = meta_node.find(key)
            if node is None:
                node = ET.SubElement(meta_node, key)
            node.text = str(value)
            
        self._save_tree(tree)

    def get_metadata(self) -> dict:
        if not os.path.exists(self.db_path):
             return {}
        try:
            tree = ET.parse(self.db_path)
            root = tree.getroot()
            meta_node = root.find("metadata")
            if meta_node is None:
                return {}
            
            return {child.tag: child.text for child in meta_node}
        except:
            return {}
            return {}
            
    # Client Management
    def _load_clients_file(self) -> List[dict]:
        clients_path = os.path.join(os.path.dirname(self.db_path), "clients.json")
        if not os.path.exists(clients_path):
            return []
        try:
            with open(clients_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []

    def get_clients(self) -> List[Client]:
        data = self._load_clients_file()
        return [Client(**c) for c in data]

    def save_client(self, client: Client) -> Client:
        clients_data = self._load_clients_file()
        clients_path = os.path.join(os.path.dirname(self.db_path), "clients.json")
        
        # Check if updating
        updated = False
        if client.id:
            for i, c in enumerate(clients_data):
                if c.get("id") == client.id:
                    clients_data[i] = client.model_dump() if hasattr(client, 'model_dump') else client.dict()
                    updated = True
                    break
        
        if not updated:
            # Creating new
            if not client.id:
                client.id = str(uuid.uuid4())
            clients_data.append(client.model_dump() if hasattr(client, 'model_dump') else client.dict())
            
        with open(clients_path, 'w', encoding='utf-8') as f:
            json.dump(clients_data, f, indent=2, ensure_ascii=False)
            
        return client

    def delete_client(self, client_id: str) -> bool:
        clients_data = self._load_clients_file()
        clients_path = os.path.join(os.path.dirname(self.db_path), "clients.json")
        
        initial_len = len(clients_data)
        filtered = [c for c in clients_data if c.get("id") != client_id]
        
        if len(filtered) < initial_len:
            with open(clients_path, 'w', encoding='utf-8') as f:
                json.dump(filtered, f, indent=2, ensure_ascii=False)
            return True
        return False

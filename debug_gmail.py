import os
import sys

# Add current directory to path so we can import backend modules
sys.path.append(os.getcwd())

from backend.gmail_service import GmailService, SCOPES

def debug_gmail():
    print("Initializing Gmail Service...")
    service = GmailService(
        credentials_path=os.path.join(os.getcwd(), "backend", "credentials.json"),
        token_path=os.path.join(os.getcwd(), "backend", "data", "token.json") 
    )
    # Note: adjusting paths because running from root, assuming backend/data exists
    # Wait, main.py uses token.json in DATA_DIR = "data".
    # Let's check where main.py expects them.
    # main.py: CREDENTIALS_PATH = os.path.join(os.getcwd(), "credentials.json")
    #          TOKEN_PATH = os.path.join(DATA_DIR, "token.json") where DATA_DIR = "data"
    
    service.credentials_path = "credentials.json"
    service.token_path = "data/token.json"
    
    if not service.authenticate():
        print("Authentication failed.")
        return

    print("Authentication successful.")
    
    # Try a broad query
    query = "has:attachment"
    print(f"Querying: {query}")
    
    try:
        results = service.service.users().messages().list(userId='me', q=query, maxResults=5).execute()
        messages = results.get('messages', [])
        
        print(f"Found {len(messages)} messages.")
        
        if not messages:
            print("No messages found with attachment.")
            
        for msg in messages:
            m = service.service.users().messages().get(userId='me', id=msg['id']).execute()
            headers = m['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '(no subject)')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), '(no sender)')
            print(f"- From: {sender} | Subject: {subject}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_gmail()

import os
import requests
from glob import glob
from urllib.parse import quote

API_URL = "http://localhost:8000/api/transactions/sync-local"
DATA_DIR = "data"

def main():
    files = glob(os.path.join(DATA_DIR, "*.html"))
    print(f"Found {len(files)} HTML files.")
    
    count = 0
    for file_path in files:
        # file_path is relative to CWD, which should be project root
        print(f"Processing {file_path}...")
        try:
            # Need to pass relative path as per my manual test? Manual test used "data/filename".
            # glob returns "data/filename".
            
            # Use params for query parameter
            response = requests.post(API_URL, params={"file_path": file_path})
            
            if response.status_code == 200:
                data = response.json()
                print(f"Success: {data}")
                count += 1
            else:
                print(f"Failed ({response.status_code}): {response.text}")
        except Exception as e:
            print(f"Error: {e}")

    print(f"Finished processing {count}/{len(files)} files.")

if __name__ == "__main__":
    main()

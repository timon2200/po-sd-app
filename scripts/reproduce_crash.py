import requests
import os
import glob
import time

API_URL = "http://localhost:8000/api/documents/merge"

def reproduce_crash():
    # Find all HTML files
    files = glob.glob(os.path.join("data", "IZV*.html"))
    files.sort()
    
    # Take 8 files to trigger the >6 condition
    files_to_merge = [os.path.basename(f) for f in files[:8]]
    
    print(f"Attempting to merge {len(files_to_merge)} files: {files_to_merge}")
    
    payload = {
        "filenames": files_to_merge
    }

    try:
        start = time.time()
        response = requests.post(API_URL, json=payload, timeout=60)
        end = time.time()
        
        print(f"Time taken: {end - start:.2f}s")
        
        if response.status_code == 200:
            print(f"Success! Content length: {len(response.content)}")
        else:
            print(f"Failed ({response.status_code}): {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    reproduce_crash()

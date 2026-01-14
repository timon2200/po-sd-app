import requests
import os
import glob
import time

API_URL = "http://localhost:8000/api/documents/merge"

def test_single():
    # Find 1 HTML file
    files = glob.glob(os.path.join("data", "IZV*.html"))
    files_to_merge = [os.path.basename(files[0])]
    
    print(f"Attempting to merge 1 file: {files_to_merge}")
    
    payload = {"filenames": files_to_merge}

    try:
        response = requests.post(API_URL, json=payload, timeout=60)
        if response.status_code == 200:
            print(f"Success! Content length: {len(response.content)}")
        else:
            print(f"Failed ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_single()

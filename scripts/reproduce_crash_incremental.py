import requests
import os
import glob
import time

API_URL = "http://localhost:8000/api/documents/merge"

def reproduce_crash():
    # Find all HTML files
    files = glob.glob(os.path.join("data", "IZV*.html"))
    files.sort()
    
    # Try different counts
    for count in [2, 4, 5, 6, 7, 8]:
        files_to_merge = [os.path.basename(f) for f in files[:count]]
        
        print(f"Attempting to merge {len(files_to_merge)} files...")
        
        payload = {"filenames": files_to_merge}

        try:
            start = time.time()
            response = requests.post(API_URL, json=payload, timeout=60)
            end = time.time()
            
            if response.status_code == 200:
                print(f"Success for {count} files! Time: {end - start:.2f}s")
            else:
                print(f"Failed for {count} files ({response.status_code}): {response.text}")
                break # Stop if failed
        except Exception as e:
            print(f"Error for {count} files: {e}")
            break

if __name__ == "__main__":
    reproduce_crash()

import requests
import os

API_URL = "http://localhost:8000/api/documents/merge"

def test_merge():
    # We will pick 3 known files
    files = [
        "IZV_2025_10_08 03_49_08_017_483.html",
        "IZV_2025_12_20 04_06_39_977_427.html",
        "IZV_2026_01_13 03_57_55_017_124.html" # The one we checked earlier
    ]
    
    # Verify they exist first
    for f in files:
        if not os.path.exists(os.path.join("data", f)):
            print(f"File missing locally: {f}")
            return

    payload = {
        "filenames": files
    }

    print(f"Requesting PDF merge for {len(files)} files...")
    try:
        response = requests.post(API_URL, json=payload)
        
        if response.status_code == 200:
            print("Success! PDF generated.")
            print(f"Content Type: {response.headers.get('content-type')}")
            print(f"Size: {len(response.content)} bytes")
            
            with open("test_merged.pdf", "wb") as f:
                f.write(response.content)
            print("Saved as test_merged.pdf")
        else:
            print(f"Failed ({response.status_code}): {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_merge()

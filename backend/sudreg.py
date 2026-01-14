import requests
import time
from typing import List, Optional
from datetime import datetime

class SudregAPI:
    BASE_URL = "https://sudreg-data.gov.hr/api/javni"
    TOKEN_URL = "https://sudreg-data.gov.hr/api/oauth/token"
    
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.token_expiry = 0

    def _get_token(self) -> str:
        if self.token and time.time() < self.token_expiry:
            return self.token
            
        # Request new token
        # Sudreg expects Basic Auth for client_id:client_secret
        payload = {
            "grant_type": "client_credentials"
        }
        
        try:
            response = requests.post(
                self.TOKEN_URL, 
                data=payload, 
                auth=(self.client_id, self.client_secret),
                verify=False
            )
            response.raise_for_status()
            data = response.json()
            
            self.token = data["access_token"]
            # Set expiry (expires_in is usually seconds, subtract a buffer)
            expires_in = data.get("expires_in", 3600)
            self.token_expiry = time.time() + expires_in - 60
            
            return self.token
        except Exception as e:
            print(f"Error getting Sudreg token: {e}")
            raise e

    def search_by_name(self, name: str) -> List[dict]:
        token = self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        # Searching strictly by name
        params = {
            "tvrtka_naziv": name
        }
        
        try:
            url = f"{self.BASE_URL}/subjekti"
            response = requests.get(url, headers=headers, params=params, verify=False)
            response.raise_for_status()
            
            # The API usually returns items list or paginated result
            # Assuming standard ORDS response or array
            data = response.json()
            
            # Handle ORDS structure if applicable (items key)
            items = data.get("items", []) if isinstance(data, dict) else data
            
            return items
        except Exception as e:
            print(f"Error searching sudreg: {e}")
            return []

    def get_details_by_oib(self, oib: str) -> Optional[dict]:
        token = self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        params = {
            "tip_identifikatora": "oib",
            "identifikator": oib
        }
        
        try:
            url = f"{self.BASE_URL}/detalji_subjekta"
            response = requests.get(url, headers=headers, params=params, verify=False)
            response.raise_for_status()
            
            data = response.json()
            return data
        except Exception as e:
            print(f"Error getting sudreg details: {e}")
            return None
            
    def map_to_client(self, raw_data: dict) -> dict:
        """
        Maps raw Sudreg response to Client dict structure.
        Note: The structure of raw_data varies between 'subjekti' list item and 'detalji_subjekta'.
        This assumes 'detalji_subjekta' structure or rich 'subjekti' item.
        """
        # Basic mapping
        # Actual fields depend on API response which we haven't seen fully.
        # But commonly: nazivi -> tvrtka_naziv, sjediste -> ulica, mjesto
        
        # Example guess based on common XML/JSON from Sudreg:
        # We try to extract what we can.
        
        client = {
            "name": raw_data.get("tvrtka_naziv") or raw_data.get("ime") or "Unknown",
            "oib": raw_data.get("oib", ""),
            "address": "",
            "city": "",
            "country": "HR"
        }
        
        # Address parsing (often separate fields for street, house number, city)
        ulica = raw_data.get("ulica_naziv", "")
        kucni_broj = raw_data.get("kucni_broj", "")
        mjesto = raw_data.get("naselje_naziv", "") or raw_data.get("mjesto_naziv", "")
        
        address_parts = [p for p in [ulica, kucni_broj] if p]
        client["address"] = " ".join(address_parts)
        client["city"] = mjesto
        
        return client

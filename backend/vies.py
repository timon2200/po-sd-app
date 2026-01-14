import requests
from typing import Optional, Dict

class ViesAPI:
    """
    Client for EU VIES VAT Validation API.
    Used as an alternative to Sudreg API for fetching company details by OIB.
    """
    BASE_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"

    def get_details_by_oib(self, oib: str) -> Optional[Dict]:
        """
        Validates OIB (VAT ID) and returns company details if valid.
        Note: Croatian OIB is the VAT number.
        """
        if not oib:
            return None
            
        # Clean OIB just in case
        oib = oib.strip()
        
        # VIES expects country code and vat number separately
        payload = {
            "countryCode": "HR",
            "vatNumber": oib
        }
        
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; POSDApp/1.0;)"
        }
        
        try:
            response = requests.post(self.BASE_URL, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("valid"):
                return {
                    "oib": oib,
                    "name": data.get("name", ""),
                    "address": data.get("address", ""),
                    "valid": True
                }
            return None
        except Exception as e:
            print(f"VIES API error: {e}")
            return None

    def map_to_client(self, vies_data: Dict) -> Dict:
        """
        Maps VIES response to Client dict structure.
        VIES returns address as a single string, often with newlines.
        """
        # Parse address: "STANKA VRAZA 10\n42000 VARAŽDIN"
        raw_address = vies_data.get("address", "")
        parts = [p.strip() for p in raw_address.split('\n') if p.strip()]
        
        address = ""
        city = ""
        postal_code = ""
        
        # Heuristic parsing
        if len(parts) > 0:
            # Last part usually City/Zip
            last_part = parts[-1] 
            # Check for zip code (5 digits)
            import re
            zip_match = re.search(r'\b\d{5}\b', last_part)
            
            if zip_match:
                postal_code = zip_match.group(0)
                city = last_part.replace(postal_code, "").strip()
            else:
                city = last_part
                
            # Remaining parts are address
            address = ", ".join(parts[:-1]) if len(parts) > 1 else parts[0]
            if not address and len(parts) == 1:
                # If only one line, maybe it's just address or just city?
                # VIES HR usually returns standard format.
                pass

        return {
            "name": vies_data.get("name", ""),
            "oib": vies_data.get("oib", ""),
            "address": address,
            "city": city,
            "postal_code": postal_code,
            "country": "HR"
        }

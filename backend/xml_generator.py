import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
from backend.models import POSDData
import uuid

def generate_posd_xml(data: POSDData) -> str:
    # Namespaces
    NS_MAIN = "http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPOSD/v3-0"
    NS_META = "http://e-porezna.porezna-uprava.hr/sheme/Metapodaci/v2-0"
    NS_DC = "http://purl.org/dc/elements/1.1/"
    NS_DCT = "http://purl.org/dc/terms/"
    
    # Register namespaces so they appear correctly in output
    ET.register_namespace('', NS_MAIN)
    ET.register_namespace('met', NS_META) # We'll just define them manually in elements usually, checking best practice
    
    # 1. Root
    root = ET.Element(f"{{{NS_MAIN}}}ObrazacPOSD", {"verzijaSheme": "1.0"})

    # 2. Metapodaci
    meta = ET.SubElement(root, f"{{{NS_MAIN}}}Metapodaci", {f"xmlns": NS_META}) # Re-declaring xmlns for Metapodaci usually happens in ePorezna
    
    # Helper to add namespaced subelement
    def add_meta_elem(parent, tag, text, dc_uri=None, attribs=None):
        if attribs is None: attribs = {}
        if dc_uri:
            attribs["dc"] = dc_uri
            
        elem = ET.SubElement(parent, f"{{{NS_META}}}{tag}", attribs)
        elem.text = text
        return elem

    add_meta_elem(meta, "Naslov", "Izvješće o paušalnom dohotku od samostalnih djelatnosti i uplaćenom paušalnom porezu na dohodak i prirezu poreza na dohodak", dc_uri="http://purl.org/dc/elements/1.1/title")
    add_meta_elem(meta, "Autor", data.name, dc_uri="http://purl.org/dc/elements/1.1/creator")
    add_meta_elem(meta, "Datum", datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), dc_uri="http://purl.org/dc/elements/1.1/date")
    add_meta_elem(meta, "Format", "text/xml", dc_uri="http://purl.org/dc/elements/1.1/format")
    add_meta_elem(meta, "Jezik", "hr-HR", dc_uri="http://purl.org/dc/elements/1.1/language")
    add_meta_elem(meta, "Identifikator", str(uuid.uuid4()), dc_uri="http://purl.org/dc/elements/1.1/identifier")
    add_meta_elem(meta, "Uskladjenost", "ObrazacPOSD-v3-0", dc_uri="http://purl.org/dc/terms/conformsTo")
    add_meta_elem(meta, "Tip", "Elektronički obrazac", dc_uri="http://purl.org/dc/elements/1.1/type")
    add_meta_elem(meta, "Adresant", "Ministarstvo Financija, Porezna uprava, Zagreb")

    # 3. Zaglavlje
    zaglavlje = ET.SubElement(root, f"{{{NS_MAIN}}}Zaglavlje")
    
    # 3.1 Obveznik parsing
    # Parse address: "STANKA VRAZA 10, VARAŽDIN" -> Street: STANKA VRAZA, Num: 10, City: VARAŽDIN
    street = "STANKA VRAZA"
    number = "10"
    city = "VARAŽDIN"
    
    try:
        if "," in data.address:
            parts = data.address.split(",")
            street_part = parts[0].strip() # STANKA VRAZA 10
            city = parts[1].strip() # VARAŽDIN
            
            # Simple heuristic for number (last word)
            street_tokens = street_part.split(" ")
            if street_tokens[-1].isdigit():
                number = street_tokens[-1]
                street = " ".join(street_tokens[:-1])
            else:
                street = street_part
                number = ""
    except:
        pass # Fallback to defaults

    obveznik = ET.SubElement(zaglavlje, f"{{{NS_MAIN}}}Obveznik")
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}OIB").text = data.oib
    
    # Name splitting logic
    full_name = data.name
    # Handle "Obrt, vl. Ime Prezime" format
    if "vl." in full_name:
        parts = full_name.split("vl.")
        if len(parts) > 1:
            full_name = parts[1].strip()
            
    ime = "Timon"
    prezime = "Terzić"
    
    if " " in full_name:
        # Split on first space for Ime/Prezime
        # Logic: First word is Ime, rest is Prezime (simplistic but works for most)
        parts = full_name.strip().split(" ", 1)
        ime = parts[0]
        if len(parts) > 1:
            prezime = parts[1]
        else:
            prezime = ""
        
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}Ime").text = ime
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}Prezime").text = prezime
    
    adresa = ET.SubElement(obveznik, f"{{{NS_MAIN}}}Adresa")
    ET.SubElement(adresa, f"{{{NS_MAIN}}}Mjesto").text = city
    ET.SubElement(adresa, f"{{{NS_MAIN}}}Ulica").text = street
    ET.SubElement(adresa, f"{{{NS_MAIN}}}Broj").text = number
    
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}Email").text = "timon.terzic@gmail.com" # Should be in metadata/settings

    # 3.2 PodaciODjelatnosti
    djelatnost = ET.SubElement(zaglavlje, f"{{{NS_MAIN}}}PodaciODjelatnosti")
    ET.SubElement(djelatnost, f"{{{NS_MAIN}}}NazivDjelatnosti").text = "RAČUNALNO PROGRAMIRANJE"
    ET.SubElement(djelatnost, f"{{{NS_MAIN}}}VrstaDjelatnostiNkd2007").text = "6201" # Common for devs
    ET.SubElement(djelatnost, f"{{{NS_MAIN}}}AdresaDjelatnosti").text = data.address

    # 3.3 Razdoblje
    razdoblje = ET.SubElement(zaglavlje, f"{{{NS_MAIN}}}Razdoblje")
    ET.SubElement(razdoblje, f"{{{NS_MAIN}}}DatumOd").text = f"{data.year}-01-01"
    ET.SubElement(razdoblje, f"{{{NS_MAIN}}}DatumDo").text = f"{data.year}-12-31"
    
    # 3.4 PotpomognutaPodrucja
    pp = ET.SubElement(zaglavlje, f"{{{NS_MAIN}}}PotpomognutaPodrucjaIGradVukovar")
    ET.SubElement(pp, f"{{{NS_MAIN}}}PotpomognutoPodrucje").text = "NE"
    ET.SubElement(pp, f"{{{NS_MAIN}}}GradVukovar").text = "NE"
    ET.SubElement(pp, f"{{{NS_MAIN}}}OtociISkupine").text = "NE"

    # 4. Tijelo
    tijelo = ET.SubElement(root, f"{{{NS_MAIN}}}Tijelo")
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}PrivremenaObustavaCijeluGodinu").text = "NE"
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}PrestanakIzlazakIzObrtaPrijePocetkaSezone").text = "NE"
    
    # 4.0 RazdobljePojedinacneDjelatnosti
    rpd = ET.SubElement(tijelo, f"{{{NS_MAIN}}}RazdobljePojedinacneDjelatnosti")
    rpd_raz = ET.SubElement(rpd, f"{{{NS_MAIN}}}Razdoblje")
    ET.SubElement(rpd_raz, f"{{{NS_MAIN}}}DatumOd").text = f"{data.year}-01-01"
    ET.SubElement(rpd_raz, f"{{{NS_MAIN}}}DatumDo").text = f"{data.year}-12-31"

    ET.SubElement(tijelo, f"{{{NS_MAIN}}}RazdobljeZajednickeDjelatnosti")
    
    # 4.1 PodaciOPrimicima
    primici = ET.SubElement(tijelo, f"{{{NS_MAIN}}}PodaciOPrimicima")
    
    receipts_fmt = "{:.2f}".format(data.total_receipts)
    tax_base_fmt = "{:.2f}".format(data.annual_tax_base) if data.annual_tax_base else "0.00"
    
    ET.SubElement(primici, f"{{{NS_MAIN}}}PrimiciUGotovini").text = "0.00"
    ET.SubElement(primici, f"{{{NS_MAIN}}}PrimiciBezGotovine").text = receipts_fmt
    ET.SubElement(primici, f"{{{NS_MAIN}}}Ukupno").text = receipts_fmt
    
    # 4.2 GodisnjiDohodak...
    # GodisnjiDohodak refers to the annual tax base determined by the bracket
    
    gd_poj = ET.SubElement(tijelo, f"{{{NS_MAIN}}}GodisnjiDohodakOdPojedinacneDjelatnosti")
    ET.SubElement(gd_poj, f"{{{NS_MAIN}}}GodisnjiDohodak").text = tax_base_fmt
    ET.SubElement(gd_poj, f"{{{NS_MAIN}}}BrojMjeseciObavljanjaDjelatnosti").text = "12"
    
    gd_zaj = ET.SubElement(tijelo, f"{{{NS_MAIN}}}GodisnjiDohodakOdZajednickeDjelatnosti")
    ET.SubElement(gd_zaj, f"{{{NS_MAIN}}}GodisnjiDohodak").text = "0.00"
    ET.SubElement(gd_zaj, f"{{{NS_MAIN}}}BrojMjeseciObavljanjaDjelatnosti").text = "0"
    
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}UkupniGodisnjiDohodak").text = tax_base_fmt
    
    # 4.3 ObracunPorezaIPrireza
    obracun = ET.SubElement(tijelo, f"{{{NS_MAIN}}}ObracunPorezaIPrireza")
    
    # Calculations
    obveza = data.base_tax_liability if data.base_tax_liability else 0.0
    uplaceno = data.tax_paid # combined
    razlika_uplata = max(0.0, obveza - uplaceno)
    razlika_povrat = max(0.0, uplaceno - obveza)
    
    ET.SubElement(obracun, f"{{{NS_MAIN}}}ObvezaPoreza").text = "{:.2f}".format(obveza)
    ET.SubElement(obracun, f"{{{NS_MAIN}}}ProsjecnaStopa").text = "0.000" # Not used for fixed? Or 0?
    ET.SubElement(obracun, f"{{{NS_MAIN}}}Prirez").text = "0.00" # Combined in pausal usually or 0
    ET.SubElement(obracun, f"{{{NS_MAIN}}}UkupniPorezIPrirez").text = "{:.2f}".format(obveza)
    ET.SubElement(obracun, f"{{{NS_MAIN}}}UmanjenjePorezaIPrireza").text = "0.00"
    
    ET.SubElement(obracun, f"{{{NS_MAIN}}}UkupnaObvezaPorezaIPrireza").text = "{:.2f}".format(obveza)
    ET.SubElement(obracun, f"{{{NS_MAIN}}}UkupniUplaceniPorezIPrirez").text = "{:.2f}".format(uplaceno)
    
    ET.SubElement(obracun, f"{{{NS_MAIN}}}RazlikaZaUplatu").text = "{:.2f}".format(razlika_uplata)
    ET.SubElement(obracun, f"{{{NS_MAIN}}}RazlikaZaPovrat").text = "{:.2f}".format(razlika_povrat)
    ET.SubElement(obracun, f"{{{NS_MAIN}}}MjesecniPausalniPorezIPrirez").text = "{:.2f}".format(obveza / 12)
    
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}DostavaPrilogaPOSD30DaNe").text = "NE"
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}Prilozi")

    # Generate string
    # We need to manually handle namespaces a bit cleanly or use ElementTree default
    # Since we registered NS_MAIN as default (''), it should be fine.
    
    xml_str = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    
    # Pretty print
    try:
        reparsed = minidom.parseString(xml_str)
        return reparsed.toprettyxml(indent="  ")
    except:
        return xml_str.decode("utf-8")

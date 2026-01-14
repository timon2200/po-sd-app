import xml.etree.ElementTree as ET
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
    def add_meta_elem(parent, tag, text, xmlns=None, attribs=None):
        if attribs is None: attribs = {}
        # In the user sample, Metapodaci items have dc attributes and are in Metapodaci namespace
        # Actually in user sample: <Naslov dc=".../title">...
        elem = ET.SubElement(parent, f"{{{NS_META}}}{tag}", attribs)
        elem.text = text
        return elem

    add_meta_elem(meta, "Naslov", "Izvješće o paušalnom dohotku od samostalnih djelatnosti i uplaćenom paušalnom porezu na dohodak i prirezu poreza na dohodak", attribs={f"{{{NS_DC}}}title": "Izvješće o paušalnom dohotku ..."})
    add_meta_elem(meta, "Autor", "GENERATE-POSD-APP", attribs={f"{{{NS_DC}}}creator": "GENERATE-POSD-APP"})
    add_meta_elem(meta, "Datum", datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), attribs={f"{{{NS_DC}}}date": datetime.now().isoformat()})
    add_meta_elem(meta, "Format", "text/xml", attribs={f"{{{NS_DC}}}format": "text/xml"})
    add_meta_elem(meta, "Jezik", "hr-HR", attribs={f"{{{NS_DC}}}language": "hr-HR"})
    add_meta_elem(meta, "Identifikator", str(uuid.uuid4()), attribs={f"{{{NS_DC}}}identifier": str(uuid.uuid4())})
    add_meta_elem(meta, "Uskladjenost", "ObrazacPOSD-v3-0", attribs={f"{{{NS_DCT}}}conformsTo": "ObrazacPOSD-v3-0"})
    add_meta_elem(meta, "Tip", "Elektronički obrazac", attribs={f"{{{NS_DC}}}type": "Elektronički obrazac"})
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
    
    # Name splitting
    ime = "Timon"
    prezime = "Terzić"
    if " " in data.name:
        ime, prezime = data.name.split(" ", 1)
        
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}Ime").text = ime
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}Prezime").text = prezime
    
    adresa = ET.SubElement(obveznik, f"{{{NS_MAIN}}}Adresa")
    ET.SubElement(adresa, f"{{{NS_MAIN}}}Mjesto").text = city
    ET.SubElement(adresa, f"{{{NS_MAIN}}}Ulica").text = street
    ET.SubElement(adresa, f"{{{NS_MAIN}}}Broj").text = number
    
    ET.SubElement(obveznik, f"{{{NS_MAIN}}}Email").text = "timon.terzic@example.com" # Should be in metadata/settings

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
    
    # Empty elements
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}RazdobljePojedinacneDjelatnosti")
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}RazdobljeZajednickeDjelatnosti")
    
    # 4.1 PodaciOPrimicima
    primici = ET.SubElement(tijelo, f"{{{NS_MAIN}}}PodaciOPrimicima")
    
    receipts_fmt = "{:.2f}".format(data.total_receipts)
    
    ET.SubElement(primici, f"{{{NS_MAIN}}}PrimiciUGotovini").text = "0.00"
    ET.SubElement(primici, f"{{{NS_MAIN}}}PrimiciBezGotovine").text = receipts_fmt
    ET.SubElement(primici, f"{{{NS_MAIN}}}Ukupno").text = receipts_fmt
    
    # 4.2 GodisnjiDohodak...
    # Assuming logic: Dohodak = Ukupni primici (simplified for pausal? No, pausal tax base is fixed by tiers usually, 
    # but strictly PO-SD reports RECEIPTS as basis for determining tier.
    # Actually, "GodisnjiDohodak" here might refer to the taxable base. 
    # But usually for PAUSAL, you report Receipts, and the form calculates tax.
    # Wait, the user sample has "GodisnjiDohodakOfPojedinacneDjelatnosti" -> GodisnjiDohodak.
    # In PO-SD, usually "Dohodak" implies the receipts amount relevant for tier.
    
    gd_poj = ET.SubElement(tijelo, f"{{{NS_MAIN}}}GodisnjiDohodakOdPojedinacneDjelatnosti")
    ET.SubElement(gd_poj, f"{{{NS_MAIN}}}GodisnjiDohodak").text = receipts_fmt
    ET.SubElement(gd_poj, f"{{{NS_MAIN}}}BrojMjeseciObavljanjaDjelatnosti").text = "12"
    
    gd_zaj = ET.SubElement(tijelo, f"{{{NS_MAIN}}}GodisnjiDohodakOdZajednickeDjelatnosti")
    ET.SubElement(gd_zaj, f"{{{NS_MAIN}}}GodisnjiDohodak").text = "0.00"
    ET.SubElement(gd_zaj, f"{{{NS_MAIN}}}BrojMjeseciObavljanjaDjelatnosti").text = "0"
    
    ET.SubElement(tijelo, f"{{{NS_MAIN}}}UkupniGodisnjiDohodak").text = receipts_fmt
    
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
    return xml_str.decode("utf-8")

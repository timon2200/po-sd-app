import sys
import io
try:
    from xhtml2pdf import pisa
except ImportError:
    pisa = None

def convert_html_to_pdf(source_path, dest_path):
    if pisa is None:
        print("Error: xhtml2pdf not installed")
        sys.exit(1)
    try:
        with open(source_path, "r", encoding="utf-8") as f:
            source_html = f.read()
            
        with open(dest_path, "wb") as output_file:
            pisa_status = pisa.CreatePDF(source_html, dest=output_file)
            
        if pisa_status.err:
            print(f"Error converting {source_path}")
            sys.exit(1)
            
        print(f"Successfully converted {source_path}")
        sys.exit(0)
        
    except Exception as e:
        print(f"Exception converting {source_path}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python pdf_worker.py <input_html> <output_pdf>")
        sys.exit(1)
        
    convert_html_to_pdf(sys.argv[1], sys.argv[2])

import subprocess
import sys

# Install pymupdf
subprocess.check_call([sys.executable, "-m", "pip", "install", "pymupdf"])

import fitz  # PyMuPDF

pdf_path = r"c:\Users\aakhi\Desktop\Krid.Ai\Assignment_ Multi-Tenant WhatsApp Agent.pdf"
doc = fitz.open(pdf_path)

full_text = ""
for i, page in enumerate(doc):
    full_text += f"\n=== PAGE {i+1} ===\n"
    full_text += page.get_text()

output_path = r"c:\Users\aakhi\Desktop\Krid.Ai\assignment_text.txt"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(full_text)

print(f"Extracted {len(doc)} pages to {output_path}")
print(full_text)

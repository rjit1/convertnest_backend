"""
Test Google Vision API ONLY on handwritten image
"""
import sys
import os

# Load environment variables FIRST
from dotenv import load_dotenv
load_dotenv('E:/tool/convertnest-backend/python-service/.env')

sys.path.append('E:/tool/convertnest-backend/python-service')

from pathlib import Path
from table_extractor import TableExtractor
from excel_generator import ExcelGenerator

image_path = 'E:/tool/IMG20251104124758.jpg'

print("="*80)
print("GOOGLE VISION API - HANDWRITING MODE TEST")
print("="*80)
print(f"\nImage: {image_path}")
print(f"OCR Engine: {os.getenv('OCR_ENGINE', 'NOT SET')}\n")

# Initialize with Vision API
print("Initializing Google Vision API...")
extractor = TableExtractor()

print(f"\nOCR Engine in use: {extractor.ocr_engine}")
print(f"Vision Client: {'✓ Initialized' if extractor.vision_client else '✗ Not initialized'}\n")

if extractor.ocr_engine != 'vision' or not extractor.vision_client:
    print("ERROR: Vision API not initialized properly!")
    print(f"Check that GOOGLE_APPLICATION_CREDENTIALS_JSON is set in .env")
    sys.exit(1)

print("Starting table extraction...")
result = extractor.extract_tables(
    image_path=image_path,
    min_confidence=10,
    detect_rotation_flag=True
)

if not result.get('tables'):
    print("\n✗ No tables detected!")
    sys.exit(1)

table = result['tables'][0]
grid = table.get('grid', [])

print(f"\n{'='*80}")
print("EXTRACTION RESULTS")
print(f"{'='*80}")
print(f"\n✓ Table detected: {len(grid)} rows × {len(grid[0]) if grid else 0} columns")
print(f"✓ Detection confidence: {table.get('detection_confidence', 0):.1%}")
print(f"✓ Rotation corrected: {result.get('rotation_corrected', 0):.1f}°")

# Count non-empty cells
cells_with_text = sum(1 for row in grid for cell in row if cell.get('text', '').strip())
total_cells = sum(len(row) for row in grid)

print(f"\n✓ Cells with text: {cells_with_text}/{total_cells}")

# Calculate average confidence
confidences = [cell.get('ocr_confidence', 0) for row in grid for cell in row if cell.get('text', '').strip()]
avg_conf = sum(confidences) / len(confidences) if confidences else 0
print(f"✓ Average OCR confidence: {avg_conf:.1f}%")

# Show first 5 rows with data
print(f"\n{'='*80}")
print("SAMPLE EXTRACTED TEXT (First 5 rows)")
print(f"{'='*80}")

for i, row in enumerate(grid[:5]):
    has_data = any(cell.get('text', '').strip() for cell in row)
    if has_data or i < 3:  # Show first 3 rows even if empty
        print(f"\nRow {i+1}:")
        for j, cell in enumerate(row[:8]):  # Show up to 8 columns
            text = cell.get('text', '').strip()
            conf = cell.get('ocr_confidence', 0)
            if text:
                # Truncate long text
                display_text = text if len(text) <= 30 else text[:27] + '...'
                print(f"  Col {j+1}: '{display_text}' (conf: {conf:.1f}%)")
            elif i < 3:  # Show empty for first 3 rows
                print(f"  Col {j+1}: [empty]")

# Generate Excel
print(f"\n{'='*80}")
print("GENERATING EXCEL FILE")
print(f"{'='*80}")

gen = ExcelGenerator()
output_path = 'E:/tool/convertnest-backend/python-service/outputs/vision_api_handwriting.xlsx'
info = gen.create_excel(result['tables'], output_path, original_filename=Path(image_path).name)

print(f"\n✓ Excel file created successfully!")
print(f"  - Path: {output_path}")
print(f"  - Size: {info['file_size']:,} bytes")
print(f"  - Sheets: {info['num_sheets']}")

print(f"\n{'='*80}")
print("TEST COMPLETE - OPEN THE EXCEL FILE TO SEE RESULTS!")
print(f"{'='*80}")
print(f"\nFile location: {output_path}")

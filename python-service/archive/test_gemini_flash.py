"""
Test Gemini 2.5 Flash for handwritten table extraction
Single API call - extracts entire table structure and text
"""

import google.generativeai as genai
from PIL import Image
import json
import os

# Configure Gemini
GEMINI_API_KEY = "AIzaSyAe6-YcUO_JbNvPKudWRJe2X78dNpJhjFI"
genai.configure(api_key=GEMINI_API_KEY)

# Test image path
IMAGE_PATH = "E:/tool/IMG20251104124758.jpg"

print("=" * 80)
print("GEMINI 2.5 FLASH - HANDWRITTEN TABLE EXTRACTION TEST")
print("=" * 80)
print(f"\nImage: {IMAGE_PATH}")
print(f"Model: gemini-2.5-flash")
print(f"\nProcessing handwritten table...")
print("-" * 80)

# Load image
img = Image.open(IMAGE_PATH)
print(f"✓ Image loaded: {img.size[0]}x{img.size[1]} pixels")

# Initialize Gemini model
model = genai.GenerativeModel('gemini-2.5-flash')

# Craft a precise prompt for table extraction
prompt = """You are an expert OCR system specialized in extracting handwritten tables.

TASK: Extract ALL text from this handwritten table image into a structured JSON format.

REQUIREMENTS:
1. Detect the table structure (rows and columns)
2. Extract ALL handwritten text from each cell (even if messy/cursive)
3. Preserve exact text as written (don't correct spelling)
4. Handle multilingual text (English, Arabic, Hebrew, etc.)
5. Empty cells should be represented as empty strings ""

OUTPUT FORMAT (JSON):
{
  "table_structure": {
    "rows": <number>,
    "columns": <number>
  },
  "data": [
    ["cell_1_1", "cell_1_2", "cell_1_3", ...],
    ["cell_2_1", "cell_2_2", "cell_2_3", ...],
    ...
  ],
  "metadata": {
    "total_cells": <number>,
    "cells_with_text": <number>,
    "confidence": "high|medium|low"
  }
}

CRITICAL: 
- Extract EVERY cell, even if text is unclear or partially visible
- For unclear text, provide your best interpretation
- Do NOT skip empty cells - include them as ""
- Return ONLY valid JSON, no markdown or extra text

Begin extraction now:"""

try:
    # Generate response with Gemini
    response = model.generate_content([prompt, img])
    
    print("\n" + "=" * 80)
    print("GEMINI RESPONSE")
    print("=" * 80)
    
    # Get response text
    response_text = response.text.strip()
    
    # Try to extract JSON from markdown code blocks if present
    if "```json" in response_text:
        json_start = response_text.find("```json") + 7
        json_end = response_text.find("```", json_start)
        json_text = response_text[json_start:json_end].strip()
    elif "```" in response_text:
        json_start = response_text.find("```") + 3
        json_end = response_text.find("```", json_start)
        json_text = response_text[json_start:json_end].strip()
    else:
        json_text = response_text
    
    # Parse JSON
    try:
        result = json.loads(json_text)
        
        # Display results
        print(f"\n✓ Table Structure: {result['table_structure']['rows']} rows × {result['table_structure']['columns']} columns")
        print(f"✓ Total Cells: {result['metadata']['total_cells']}")
        print(f"✓ Cells with Text: {result['metadata']['cells_with_text']}")
        print(f"✓ Confidence: {result['metadata']['confidence']}")
        
        print("\n" + "=" * 80)
        print("EXTRACTED TABLE DATA (First 10 rows)")
        print("=" * 80)
        
        for i, row in enumerate(result['data'][:10], 1):
            print(f"\nRow {i}:")
            for j, cell in enumerate(row, 1):
                if cell:  # Only show non-empty cells
                    print(f"  Col {j}: '{cell}'")
        
        # Save full JSON output
        output_file = "e:/tool/convertnest-backend/python-service/outputs/gemini_flash_result.json"
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print("\n" + "=" * 80)
        print("✓ Full JSON saved to:", output_file)
        print("=" * 80)
        
        # Calculate token usage (approximate)
        print("\n" + "=" * 80)
        print("COST ANALYSIS")
        print("=" * 80)
        
        # Estimate tokens (image ~774 tokens based on size calculation)
        input_tokens = 774 + len(prompt.split()) * 1.3  # Image + text prompt
        output_tokens = len(json_text.split()) * 1.3  # Response
        
        input_cost = (input_tokens / 1_000_000) * 0.30  # $0.30 per 1M tokens
        output_cost = (output_tokens / 1_000_000) * 2.50  # $2.50 per 1M tokens
        total_cost = input_cost + output_cost
        
        print(f"Estimated Input Tokens: ~{int(input_tokens)}")
        print(f"Estimated Output Tokens: ~{int(output_tokens)}")
        print(f"Estimated Cost: ${total_cost:.6f} (~{total_cost*100:.4f} cents)")
        print(f"\nCost per 1,000 tables: ${total_cost * 1000:.2f}")
        
    except json.JSONDecodeError as e:
        print(f"\n❌ Failed to parse JSON response")
        print(f"Error: {e}")
        print(f"\nRaw response:\n{response_text[:500]}...")
        
        # Save raw response for debugging
        debug_file = "e:/tool/convertnest-backend/python-service/outputs/gemini_debug.txt"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(response_text)
        print(f"\n✓ Raw response saved to: {debug_file}")

except Exception as e:
    print(f"\n❌ Error during Gemini API call: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)

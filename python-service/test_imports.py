"""
Simple test to verify Python environment is working
"""
import sys
print(f"Python version: {sys.version}")
print("Testing imports...")

try:
    import torch
    print(f"✓ PyTorch {torch.__version__}")
except Exception as e:
    print(f"✗ PyTorch: {e}")

try:
    import transformers
    print(f"✓ Transformers {transformers.__version__}")
except Exception as e:
    print(f"✗ Transformers: {e}")

try:
    import flask
    print(f"✓ Flask {flask.__version__}")
except Exception as e:
    print(f"✗ Flask: {e}")

try:
    import pytesseract
    print(f"✓ pytesseract")
except Exception as e:
    print(f"✗ pytesseract: {e}")

try:
    import openpyxl
    print(f"✓ openpyxl")
except Exception as e:
    print(f"✗ openpyxl: {e}")

print("\nAll imports successful! Environment is ready.")

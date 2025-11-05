#!/bin/bash
# Setup script for TATR Python Service (Linux/macOS)

echo "========================================"
echo "TATR Python Service Setup"
echo "========================================"
echo ""

# Check Python installation
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found!"
    echo "Please install Python 3.8+ from https://www.python.org/downloads/"
    exit 1
fi

python3 --version
echo ""

# Create virtual environment
echo "Creating virtual environment..."
if [ -d ".venv" ]; then
    echo "Virtual environment already exists"
else
    python3 -m venv .venv
    echo "Virtual environment created"
fi
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate
echo "Virtual environment activated"
echo ""

# Upgrade pip
echo "Upgrading pip..."
python -m pip install --upgrade pip --quiet
echo "pip upgraded"
echo ""

# Install dependencies
echo "Installing Python dependencies..."
echo "(This may take 5-10 minutes - downloading PyTorch and TATR models)"
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully"
else
    echo "ERROR: Failed to install dependencies"
    exit 1
fi
echo ""

# Create .env file
echo "Configuring environment..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ".env file created"
else
    echo ".env file already exists"
fi
echo ""

# Check Tesseract installation
echo "Checking Tesseract OCR..."
if command -v tesseract &> /dev/null; then
    tesseract --version | head -1
else
    echo "WARNING: Tesseract not found"
    echo "Please install Tesseract OCR:"
    echo "  Ubuntu/Debian: sudo apt-get install tesseract-ocr"
    echo "  macOS: brew install tesseract"
fi
echo ""

# Create directories
echo "Creating working directories..."
mkdir -p uploads outputs
echo "Directories created"
echo ""

# Test imports
echo "Testing Python imports..."
python -c "
try:
    import torch
    import transformers
    import pytesseract
    import openpyxl
    import flask
    print('SUCCESS: All imports working')
except ImportError as e:
    print(f'ERROR: {e}')
    exit(1)
"
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "To start the service:"
echo "  source .venv/bin/activate"
echo "  python app.py"
echo ""
echo "Service will run on: http://localhost:5000"
echo ""
echo "Note: First run will download TATR models (~220 MB)"
echo "      This is a one-time download"
echo ""

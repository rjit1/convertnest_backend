# Setup script for TATR Python Service
# Run this to install and configure the service

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TATR Python Service Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "ERROR: Python not found!" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

$pythonVersion = python --version
Write-Host "Found: $pythonVersion" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "requirements.txt")) {
    Write-Host "ERROR: requirements.txt not found!" -ForegroundColor Red
    Write-Host "Please run this script from the python-service directory" -ForegroundColor Red
    exit 1
}

# Create virtual environment
Write-Host "Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path ".venv") {
    Write-Host "Virtual environment already exists" -ForegroundColor Green
} else {
    python -m venv .venv
    Write-Host "Virtual environment created" -ForegroundColor Green
}
Write-Host ""

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1
Write-Host "Virtual environment activated" -ForegroundColor Green
Write-Host ""

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
Write-Host "pip upgraded" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
Write-Host "(This may take 5-10 minutes - downloading PyTorch and TATR models)" -ForegroundColor Cyan
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Create .env file
Write-Host "Configuring environment..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ".env file created" -ForegroundColor Green
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}
Write-Host ""

# Check Tesseract installation
Write-Host "Checking Tesseract OCR..." -ForegroundColor Yellow
$tesseractCmd = Get-Command tesseract -ErrorAction SilentlyContinue
if ($tesseractCmd) {
    $tesseractVersion = tesseract --version 2>&1 | Select-Object -First 1
    Write-Host "Found: $tesseractVersion" -ForegroundColor Green
} else {
    Write-Host "WARNING: Tesseract not found in PATH" -ForegroundColor Yellow
    Write-Host "Please install Tesseract OCR:" -ForegroundColor Yellow
    Write-Host "  Windows: https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor Cyan
    Write-Host "  Then add to PATH or set TESSERACT_CMD in .env" -ForegroundColor Cyan
}
Write-Host ""

# Create directories
Write-Host "Creating working directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "outputs" | Out-Null
Write-Host "Directories created" -ForegroundColor Green
Write-Host ""

# Test imports
Write-Host "Testing Python imports..." -ForegroundColor Yellow
$testScript = @"
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
"@

$testResult = python -c $testScript
if ($LASTEXITCODE -eq 0) {
    Write-Host $testResult -ForegroundColor Green
} else {
    Write-Host $testResult -ForegroundColor Red
    exit 1
}
Write-Host ""

# Download models (they'll download on first use, but we can test connection)
Write-Host "Checking model availability..." -ForegroundColor Yellow
$modelTest = @"
from transformers import AutoImageProcessor
try:
    processor = AutoImageProcessor.from_pretrained('microsoft/table-transformer-detection')
    print('SUCCESS: Models accessible')
except Exception as e:
    print(f'ERROR: {e}')
"@

python -c $modelTest
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the service:" -ForegroundColor Yellow
Write-Host "  python app.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service will run on: http://localhost:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: First run will download TATR models (~220 MB)" -ForegroundColor Yellow
Write-Host "      This is a one-time download" -ForegroundColor Yellow
Write-Host ""

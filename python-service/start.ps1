# Start TATR Python Service
Write-Host "Starting TATR Python Service..." -ForegroundColor Cyan

# Navigate to python-service directory
Set-Location -Path "E:\tool\convertnest-backend\python-service"

# Activate virtual environment
& .\.venv\Scripts\Activate.ps1

# Add Tesseract to PATH
$env:Path += ";C:\Program Files\Tesseract-OCR"

# Start the service
Write-Host "Starting Flask application on http://localhost:5000" -ForegroundColor Green
Write-Host "Note: First run will download TATR models (~220MB)" -ForegroundColor Yellow
Write-Host ""

python app.py

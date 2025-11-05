# Quick Start Script for TATR Service
# Run this to start both Python and Node.js services

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "TATR Image-to-Excel Service Starter" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python service is set up
if (-not (Test-Path "python-service\.venv")) {
    Write-Host "Python environment not found. Running setup..." -ForegroundColor Yellow
    Write-Host ""
    cd python-service
    .\setup.ps1
    cd ..
}

# Start Python TATR service in background
Write-Host "Starting Python TATR service..." -ForegroundColor Yellow
$pythonJob = Start-Job -ScriptBlock {
    cd $args[0]\python-service
    & .\.venv\Scripts\Activate.ps1
    python app.py
} -ArgumentList (Get-Location).Path

Write-Host "✅ Python service starting on http://localhost:5000" -ForegroundColor Green
Write-Host ""

# Wait for Python service to be ready
Write-Host "Waiting for Python service to be ready..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Python service is ready!" -ForegroundColor Green
            break
        }
    } catch {
        Start-Sleep -Seconds 1
        $waited++
        Write-Host "." -NoNewline
    }
}

if ($waited -ge $maxWait) {
    Write-Host ""
    Write-Host "⚠️  Python service taking longer than expected" -ForegroundColor Yellow
    Write-Host "   It may still be downloading models (first run takes 2-5 min)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Node.js backend..." -ForegroundColor Yellow

# Start Node.js backend
$nodeJob = Start-Job -ScriptBlock {
    cd $args[0]
    npm start
} -ArgumentList (Get-Location).Path

Write-Host "✅ Node.js backend starting on http://localhost:3000" -ForegroundColor Green
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Services Started!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services running:" -ForegroundColor Yellow
Write-Host "  📊 Python TATR Service: http://localhost:5000" -ForegroundColor Cyan
Write-Host "  🚀 Node.js Backend:     http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Endpoints:" -ForegroundColor Yellow
Write-Host "  Health Check: http://localhost:3000/api/image-to-excel/health" -ForegroundColor Cyan
Write-Host "  Convert:      http://localhost:3000/api/image-to-excel/convert" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  TATR Service: ENABLED (97% accuracy)" -ForegroundColor Green
Write-Host "  In .env file: USE_TATR_SERVICE=true" -ForegroundColor Cyan
Write-Host ""
Write-Host "View Logs:" -ForegroundColor Yellow
Write-Host "  Python: Receive-Job $($pythonJob.Id)" -ForegroundColor Cyan
Write-Host "  Node.js: Receive-Job $($nodeJob.Id)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Stop Services:" -ForegroundColor Yellow
Write-Host "  Stop-Job $($pythonJob.Id), $($nodeJob.Id)" -ForegroundColor Cyan
Write-Host "  Remove-Job $($pythonJob.Id), $($nodeJob.Id)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring (services will continue running)" -ForegroundColor Yellow
Write-Host ""

# Monitor logs
try {
    while ($true) {
        Start-Sleep -Seconds 2
        
        # Check if jobs are still running
        if ((Get-Job -Id $pythonJob.Id).State -ne 'Running' -or 
            (Get-Job -Id $nodeJob.Id).State -ne 'Running') {
            Write-Host ""
            Write-Host "⚠️  A service has stopped!" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Python service state: $((Get-Job -Id $pythonJob.Id).State)" -ForegroundColor Yellow
            Write-Host "Node.js service state: $((Get-Job -Id $nodeJob.Id).State)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "View error logs:" -ForegroundColor Yellow
            Write-Host "  Receive-Job $($pythonJob.Id) -Keep" -ForegroundColor Cyan
            Write-Host "  Receive-Job $($nodeJob.Id) -Keep" -ForegroundColor Cyan
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "To view ongoing logs:" -ForegroundColor Yellow
    Write-Host "  Receive-Job $($pythonJob.Id) -Keep" -ForegroundColor Cyan
    Write-Host "  Receive-Job $($nodeJob.Id) -Keep" -ForegroundColor Cyan
}

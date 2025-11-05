@echo off
cd /d E:\tool\convertnest-backend\python-service
call .venv\Scripts\activate.bat
set PATH=%PATH%;C:\Program Files\Tesseract-OCR
echo Starting TATR Python Service on http://localhost:5000
echo First run will download TATR models (~220MB)
echo.
python app.py

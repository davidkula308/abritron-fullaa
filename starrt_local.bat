@echo off
echo ===============================
echo   ARBITRON AI - LOCAL MODE
echo ===============================

echo.
echo Checking Node...
node -v || (echo Install Node.js first & pause & exit)

echo Checking Python...
python --version || (echo Install Python first & pause & exit)

echo.
echo Installing backend dependencies...
cd backend
call npm install

echo.
echo Starting backend server...
start cmd /k npm run dev

cd ..

echo.
echo Installing Python dependencies...
pip install flask MetaTrader5

echo.
echo Starting MT5 bridge...
start cmd /k python mt5_bridge.py

echo.
echo ===============================
echo   DONE 🚀
echo ===============================
echo Backend running on: http://localhost:8000
echo Keep the opened terminals running.
pause
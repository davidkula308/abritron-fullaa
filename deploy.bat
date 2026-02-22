@echo off
echo Building and running Arbitron AI...

docker build -t arbitron-ai .
docker stop arbitron-ai >nul 2>&1
docker rm arbitron-ai >nul 2>&1

docker run -d ^
  -p 8000:8000 ^
  -e TELEGRAM_TOKEN=YOUR_TOKEN ^
  -e TELEGRAM_CHAT_ID=YOUR_CHAT_ID ^
  -e MT5_LOGIN=123456 ^
  -e MT5_PASSWORD=yourpass ^
  -e MT5_SERVER=Broker-Server ^
  --name arbitron-ai arbitron-ai

echo Bot running at http://localhost:8000
pause
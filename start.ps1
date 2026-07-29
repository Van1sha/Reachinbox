#!/usr/bin/env pwsh
# ReachInbox Startup Script
# Starts both backend and frontend servers

Write-Host "🚀 Starting ReachInbox Email Scheduler..." -ForegroundColor Cyan
Write-Host ""

# Check Redis
Write-Host "Checking Redis (Memurai)..." -ForegroundColor Yellow
$redisRunning = netstat -an | findstr "6379"
if ($redisRunning) {
    Write-Host "✅ Redis is running on port 6379" -ForegroundColor Green
} else {
    Write-Host "⚠️  Redis not detected on 6379. Attempting to start Memurai..." -ForegroundColor Yellow
    $memuraiPath = "C:\Program Files\Memurai"
    if (Test-Path $memuraiPath) {
        Start-Process "memurai.exe" -WorkingDirectory $memuraiPath -WindowStyle Hidden
        Start-Sleep -Seconds 2
        Write-Host "✅ Memurai started" -ForegroundColor Green
    } else {
        Write-Host "❌ Memurai not found. Please install it first." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Starting Backend (port 4000)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "c:\Users\vanis\OneDrive\Desktop\reachinbox\backend"
    npm run dev 2>&1
}

Start-Sleep -Seconds 3

Write-Host "Starting Frontend (port 3000)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "c:\Users\vanis\OneDrive\Desktop\reachinbox\frontend"
    npm run dev 2>&1
}

Write-Host ""
Write-Host "✅ Both servers starting!" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend:  http://localhost:4000" -ForegroundColor Cyan
Write-Host "📊 Bull Board: http://localhost:4000/admin/queues" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Gray

# Stream output from both jobs
while ($true) {
    $backendOutput = Receive-Job $backendJob
    $frontendOutput = Receive-Job $frontendJob
    if ($backendOutput) { Write-Host "[Backend] $backendOutput" -ForegroundColor DarkGray }
    if ($frontendOutput) { Write-Host "[Frontend] $frontendOutput" -ForegroundColor DarkGray }
    Start-Sleep -Seconds 1
}

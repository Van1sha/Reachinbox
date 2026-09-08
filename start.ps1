#!/usr/bin/env pwsh
# ReachInbox Startup Script
# Starts both backend and frontend servers

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $scriptDir) { $scriptDir = Get-Location }

Write-Host "🚀 Starting ReachInbox Email Scheduler..." -ForegroundColor Cyan
Write-Host ""

# Check / Start Redis 7 on port 6380 via WSL
Write-Host "Checking Redis 7 (port 6380)..." -ForegroundColor Yellow
try {
    wsl redis-server --port 6380 --dir /tmp --protected-mode no --daemonize yes 2>$null
    Write-Host "✅ Redis 7 running on port 6380" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Warning starting Redis via WSL" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Backend (port 4000)..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptDir "backend"
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev 2>&1
} -ArgumentList $backendPath

Start-Sleep -Seconds 3

Write-Host "Starting Frontend (port 3000)..." -ForegroundColor Yellow
$frontendPath = Join-Path $scriptDir "frontend"
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev 2>&1
} -ArgumentList $frontendPath

Write-Host ""
Write-Host "✅ Both servers starting!" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend:  http://localhost:4000" -ForegroundColor Cyan
Write-Host "📊 Bull Board: http://localhost:4000/admin/queues" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Gray

# Stream output from both jobs
try {
    while ($true) {
        $backendOutput = Receive-Job $backendJob
        $frontendOutput = Receive-Job $frontendJob
        if ($backendOutput) { Write-Host "[Backend] $backendOutput" -ForegroundColor DarkGray }
        if ($frontendOutput) { Write-Host "[Frontend] $frontendOutput" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
}

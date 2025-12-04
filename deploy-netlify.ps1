# deploy-netlify.ps1
Write-Host "🚀 Preparing to deploy to Netlify..." -ForegroundColor Cyan

# Check if in voting-app folder
if (-not (Test-Path "package.json") -and -not (Test-Path "index.html")) {
    Write-Host "❌ Not in voting-app folder. Navigate to C:\Users\Realtime IT\Desktop\voting-app first" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Checking files..." -ForegroundColor Yellow
Get-ChildItem -File | Select-Object Name -First 10 | Format-Table

# Initialize Git if not already
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit - Neon Voting App"
}

# Check Netlify CLI
Write-Host "Checking Netlify CLI..." -ForegroundColor Yellow
try {
    netlify --version
} catch {
    Write-Host "Installing Netlify CLI..." -ForegroundColor Yellow
    npm install -g netlify-cli
}

Write-Host "`n📝 Deployment Steps:" -ForegroundColor Green
Write-Host "1. Run: netlify login" -ForegroundColor White
Write-Host "2. Run: netlify init" -ForegroundColor White
Write-Host "3. Run: netlify deploy --prod" -ForegroundColor White
Write-Host "`nOr use manual deployment:" -ForegroundColor Cyan
Write-Host "- Drag & drop folder to https://app.netlify.com/drop" -ForegroundColor White
Write-Host "- Connect GitHub repository" -ForegroundColor White

# Open Netlify dashboard
Start-Process "https://app.netlify.com"
Write-Host "`n✅ Ready to deploy! Follow steps above." -ForegroundColor Green
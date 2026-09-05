$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$javaExecutable = $null

if ($env:JAVA_HOME) {
  $javaFromHome = Join-Path $env:JAVA_HOME 'bin\java.exe'
  if (Test-Path -LiteralPath $javaFromHome) {
    $javaExecutable = Get-Item -LiteralPath $javaFromHome
  }
}

if (-not $javaExecutable) {
  $javaFromPath = Get-Command java -ErrorAction SilentlyContinue
  if ($javaFromPath) {
    $javaExecutable = Get-Item -LiteralPath $javaFromPath.Source
  }
}

if (-not $javaExecutable) {
  $workRoot = Split-Path -Parent $projectRoot
  $localJdkRoot = Join-Path $workRoot 'tooling\microsoft-jdk-21'
  $javaExecutable = Get-ChildItem -LiteralPath $localJdkRoot -Recurse -Filter 'java.exe' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\bin\\java\.exe$' } |
    Select-Object -First 1
}

if (-not $javaExecutable) {
  throw 'Java 21 or later is required. Set JAVA_HOME, add java.exe to PATH, or place the portable JDK under work\tooling\microsoft-jdk-21.'
}

$javaHome = Split-Path -Parent (Split-Path -Parent $javaExecutable.FullName)
$firebaseCommand = Join-Path $projectRoot 'node_modules\.bin\firebase.CMD'

if (-not (Test-Path -LiteralPath $firebaseCommand)) {
  throw 'Firebase CLI is missing. Install development dependencies before running the Rules suite.'
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"
$env:XDG_CONFIG_HOME = Join-Path $projectRoot '.firebase-config'
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = 'true'
$env:CI = 'true'

Push-Location $projectRoot
try {
  & $firebaseCommand emulators:exec --only firestore --project demo-reflective-rules 'node --test tests/firestore.rules.test.ts'
  exit $LASTEXITCODE
} finally {
  Pop-Location
}

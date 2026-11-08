$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot 'backend'
$templatePath = Join-Path $backendPath '.env.example'
$envPath = Join-Path $backendPath '.env'
$gitIgnorePath = Join-Path $projectRoot '.gitignore'
$postgresBinPath = 'C:\Program Files\PostgreSQL\18\bin'
$psqlPath = Join-Path $postgresBinPath 'psql.exe'
$createdbPath = Join-Path $postgresBinPath 'createdb.exe'
$icaclsPath = Join-Path $env:SystemRoot 'System32\icacls.exe'
$databaseName = 'ztalent_coder'
$credentialDirectory = $null
$temporaryEnvPath = $null
$securePassword = $null
$password = $null
$databaseUrl = $null
$previousPgpassFile = $env:PGPASSFILE
$hadPgpassFile = Test-Path Env:PGPASSFILE
$previousPgPassword = $env:PGPASSWORD
$hadPgPassword = Test-Path Env:PGPASSWORD
$pointer = [IntPtr]::Zero
$databaseCreated = $false

try {
    if (-not (Test-Path -LiteralPath $backendPath -PathType Container)) {
        throw 'The backend directory was not found.'
    }
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        throw 'backend\.env.example was not found.'
    }
    if (-not (Test-Path -LiteralPath $gitIgnorePath -PathType Leaf)) {
        throw 'The project .gitignore file was not found.'
    }
    if (-not (Test-Path -LiteralPath $psqlPath -PathType Leaf)) {
        throw 'PostgreSQL 18 psql.exe was not found at the expected installation path.'
    }
    if (-not (Test-Path -LiteralPath $createdbPath -PathType Leaf)) {
        throw 'PostgreSQL 18 createdb.exe was not found at the expected installation path.'
    }
    if (-not (Test-Path -LiteralPath $icaclsPath -PathType Leaf)) {
        throw 'Windows icacls.exe was not found; a private password file cannot be prepared safely.'
    }

    $ignoreRules = @(Get-Content -LiteralPath $gitIgnorePath)
    if (
        $ignoreRules -notcontains '.env' -or
        $ignoreRules -notcontains '.env.*' -or
        $ignoreRules -notcontains '!.env.example'
    ) {
        throw 'Expected .env ignore rules are missing. No environment file was changed.'
    }

    $templateLines = @(Get-Content -LiteralPath $templatePath)
    if (-not ($templateLines | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' })) {
        throw 'DATABASE_URL is not defined in backend\.env.example.'
    }

    $securePassword = Read-Host -Prompt 'PostgreSQL postgres-user password (masked)' -AsSecureString
    if ($null -eq $securePassword -or $securePassword.Length -eq 0) {
        throw 'A PostgreSQL password is required.'
    }

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($password.Contains("`r") -or $password.Contains("`n")) {
        throw 'Passwords containing line breaks cannot be used with the local PostgreSQL password file.'
    }

    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $currentSid = $currentIdentity.User.Value
    $credentialDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
        'ztalent-postgres-' + [Guid]::NewGuid().ToString('N')
    )
    New-Item -ItemType Directory -Path $credentialDirectory -ErrorAction Stop | Out-Null

    $aclGrant = "*${currentSid}:(OI)(CI)F"
    & $icaclsPath $credentialDirectory '/inheritance:r' '/grant:r' $aclGrant 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not restrict access to the temporary PostgreSQL password file.'
    }

    $escapedPassword = $password.Replace('\', '\\').Replace(':', '\:')
    $pgpassPath = Join-Path $credentialDirectory 'pgpass.conf'
    [System.IO.File]::WriteAllText(
        $pgpassPath,
        "localhost:5432:*:postgres:$escapedPassword`n",
        [System.Text.UTF8Encoding]::new($false)
    )
    $env:PGPASSFILE = $pgpassPath
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

    $existingDatabase = & $psqlPath `
        -w -h localhost -p 5432 -U postgres -d postgres -At `
        -c "SELECT datname FROM pg_database WHERE datname = '$databaseName';" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not authenticate to PostgreSQL or check whether the database exists.'
    }

    if (-not $existingDatabase) {
        & $createdbPath -w -h localhost -p 5432 -U postgres $databaseName 2>$null
        if ($LASTEXITCODE -eq 0) {
            $databaseCreated = $true
        } else {
            # Accept a concurrent creation only after confirming the database exists.
            $existingDatabase = & $psqlPath `
                -w -h localhost -p 5432 -U postgres -d postgres -At `
                -c "SELECT datname FROM pg_database WHERE datname = '$databaseName';" 2>$null
            if ($LASTEXITCODE -ne 0 -or -not $existingDatabase) {
                throw 'Database creation failed. Confirm the postgres user may create databases.'
            }
        }
    }

    $accessibleDatabase = & $psqlPath `
        -w -h localhost -p 5432 -U postgres -d $databaseName -At `
        -c 'SELECT current_database();' 2>$null
    if ($LASTEXITCODE -ne 0 -or $accessibleDatabase -ne $databaseName) {
        throw 'The database could not be verified as accessible.'
    }

    $encodedPassword = [Uri]::EscapeDataString($password)
    $databaseUrl = "postgresql://postgres:$encodedPassword@localhost:5432/$databaseName`?schema=public"

    if (Test-Path -LiteralPath $envPath -PathType Leaf) {
        $sourceLines = [System.IO.File]::ReadAllLines($envPath)
    } else {
        $sourceLines = [System.IO.File]::ReadAllLines($templatePath)
    }

    $updatedLines = New-Object 'System.Collections.Generic.List[string]'
    $databaseUrlFound = $false
    foreach ($line in $sourceLines) {
        if ($line -match '^\s*DATABASE_URL\s*=') {
            if (-not $databaseUrlFound) {
                $updatedLines.Add("DATABASE_URL=`"$databaseUrl`"")
                $databaseUrlFound = $true
            }
        } else {
            $updatedLines.Add($line)
        }
    }
    if (-not $databaseUrlFound) {
        $updatedLines.Add("DATABASE_URL=`"$databaseUrl`"")
    }

    $temporaryEnvPath = Join-Path $backendPath ('.env.' + [Guid]::NewGuid().ToString('N') + '.tmp')
    [System.IO.File]::WriteAllLines(
        $temporaryEnvPath,
        $updatedLines.ToArray(),
        [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temporaryEnvPath -Destination $envPath -Force
    $temporaryEnvPath = $null

    if ($databaseCreated) {
        'Database created: ztalent_coder'
    } else {
        'Database already existed: ztalent_coder'
    }
    'PostgreSQL authentication and database access: verified'
    'backend\.env DATABASE_URL: configured (value not displayed)'
    'Project .gitignore excludes .env files: verified'
    'Migrations, tables, and seed data: not created'
}
catch {
    if ($databaseCreated) {
        'Database created: ztalent_coder'
    }
    Write-Error "Setup failed: $($_.Exception.Message)"
}
finally {
    if ($null -ne $temporaryEnvPath -and (Test-Path -LiteralPath $temporaryEnvPath)) {
        Remove-Item -LiteralPath $temporaryEnvPath -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $credentialDirectory -and (Test-Path -LiteralPath $credentialDirectory)) {
        Remove-Item -LiteralPath $credentialDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }

    if ($hadPgpassFile) {
        $env:PGPASSFILE = $previousPgpassFile
    } else {
        Remove-Item Env:PGPASSFILE -ErrorAction SilentlyContinue
    }
    if ($hadPgPassword) {
        $env:PGPASSWORD = $previousPgPassword
    } else {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }

    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    if ($null -ne $securePassword) {
        $securePassword.Dispose()
    }

    $password = $null
    $databaseUrl = $null
}

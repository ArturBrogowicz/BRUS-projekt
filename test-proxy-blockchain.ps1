# --- KONFIGURACJA ---
$uri = "http://localhost:3000/api/query"
$headers = @{"Content-Type"="application/json"}
# Adres TestClienta, który ma uprawnienia tylko do SELECT na tabeli users
$userAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

# --- FUNKCJA TESTUJĄCA ---
function Run-Test {
    param (
        [string]$TestName,
        [string]$Query,
        [int]$ExpectedStatusCode
    )

    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "Uruchamianie: $TestName" -ForegroundColor Yellow
    Write-Host "Zapytanie: $Query" -ForegroundColor DarkGray

    $body = @{
        userAddress = $userAddress
        query = $Query
    } | ConvertTo-Json

    try {
        # ErrorAction Stop wymusza przejście do bloku catch w przypadku błędów HTTP (np. 403)
        $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ErrorAction Stop

        if ($ExpectedStatusCode -eq 200) {
            Write-Host "Wynik: [ZALICZONY] Status 200 (Sukces)" -ForegroundColor Green
        } else {
            Write-Host "Wynik: [OBLANY] Oczekiwano $ExpectedStatusCode, ale otrzymano 200" -ForegroundColor Red
        }

        Write-Host "Wiadomosc z serwera: $($response.message)"

        if ($response.txHashes) {
            Write-Host "Hashe transakcji na blockchainie:" -ForegroundColor DarkCyan
            $response.txHashes | ForEach-Object { Write-Host " -> $_" -ForegroundColor DarkCyan }
        }

    } catch {
        # Przechwytywanie błędów HTTP (np. 403 Forbidden)
        $exception = $_.Exception
        if ($exception.Response) {
            $statusCode = [int]$exception.Response.StatusCode

            # Próba odczytania wiadomości z formatu JSON zwróconego przez serwer
            $stream = $exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd() | ConvertFrom-Json

            if ($statusCode -eq $ExpectedStatusCode) {
                Write-Host "Wynik: [ZALICZONY] Oczekiwana odmowa ($statusCode)" -ForegroundColor Green
            } else {
                Write-Host "Wynik: [OBLANY] Nieoczekiwany kod błedu ($statusCode)" -ForegroundColor Red
            }

            Write-Host "Wiadomosc z serwera: $($errBody.message)" -ForegroundColor DarkRed
        } else {
            Write-Host "Bład połaczenia: Serwer Proxy prawdopodobnie jest wyłaczony." -ForegroundColor Red
        }
    }
    Write-Host "" # Pusta linia dla czytelności
}

# --- WYKONYWANIE TESTÓW ---
Write-Host "Rozpoczynam testy integracyjne Proxy <-> Blockchain..." -ForegroundColor Magenta
Write-Host ""

# Test 1
Run-Test -TestName "TEST 1: Sukces (Dozwolony SELECT na users)" -Query "SELECT * FROM users;" -ExpectedStatusCode 200

# Test 2
Run-Test -TestName "TEST 2: Blokada (Niedozwolony DELETE na users)" -Query "DELETE FROM users WHERE id = 1;" -ExpectedStatusCode 403

# Test 3
Run-Test -TestName "TEST 3: Blokada (Brak dostepu do tabeli logs)" -Query "SELECT * FROM logs;" -ExpectedStatusCode 403

# Test 4
Run-Test -TestName "TEST 4: Blokada (Zlaczenie JOIN - wykrycie ukrytej tabeli logs)" -Query "SELECT u.name, l.action FROM users u JOIN logs l ON u.id = l.user_id;" -ExpectedStatusCode 403

Write-Host "Zakonczono wykonywanie skryptu testowego." -ForegroundColor Cyan
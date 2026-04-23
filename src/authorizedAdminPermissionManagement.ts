import { ethers } from 'ethers';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// Stałe konfiguracyjne
const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const API_BASE_URL = "http://localhost:3000/api/admin";

async function main() {
    // Inicjalizacja interfejsu do czytania z konsoli
    const rl = readline.createInterface({ input, output });

    console.log("=========================================");
    console.log("        🔐 PANEL ADMINISTRATORA        ");
    console.log("=========================================\n");

    try {
        // 1. Wybór akcji
        console.log("Dostępne akcje:");
        console.log("  [1] Nadaj uprawnienia (Grant)");
        console.log("  [2] Odbierz uprawnienia (Revoke)\n");

        let actionChoice = '';
        while (actionChoice !== '1' && actionChoice !== '2') {
            actionChoice = await rl.question('Wybierz numer akcji (1 lub 2): ');
        }

        const isGranting = actionChoice === '1';
        const actionName = isGranting ? 'nadanie' : 'odebranie';
        const endpoint = isGranting ? '/grant' : '/revoke';

        console.log(`\n--- Konfiguracja dla akcji: ${actionName.toUpperCase()} ---`);

        // 2. Pobieranie parametrów od administratora
        const targetAddress = await rl.question('1. Podaj adres docelowy (np. 0x3C4...): ');
        const table = await rl.question('2. Podaj nazwę tabeli (np. users): ');
        const operationInput = await rl.question('3. Podaj operację (SELECT, INSERT, UPDATE, DELETE): ');

        const operation = operationInput.toUpperCase().trim();

        // Zamknięcie strumienia wejścia
        rl.close();

        // 3. Konfiguracja Portfela i Wiadomości
        const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);
        const timestamp = Date.now();
        const messageToSign = `Zatwierdzam ${actionName} uprawnien. Timestamp: ${timestamp}`;

        console.log(`\n⏳ Generowanie podpisu kryptograficznego dla ${adminWallet.address}...`);
        const signature = await adminWallet.signMessage(messageToSign);

        const payload = {
            targetAddress: targetAddress.trim(),
            table: table.trim(),
            operation: operation,
            message: messageToSign,
            signature: signature
        };

        // 4. Wysłanie HTTP POST
        console.log(`🚀 Wysyłanie żądania do: ${API_BASE_URL}${endpoint} ...\n`);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 5. Wyświetlenie wyniku
        console.log("================ WYNIK ================");
        if (data.status === 'success') {
            console.log(`✅ Sukces: ${data.message}`);
            if (data.txHash) console.log(`🔗 Hash Transakcji: ${data.txHash}`);
        } else {
            console.log(`❌ Błąd: ${data.message}`);
        }
        console.log("=======================================\n");

    } catch (error) {
        console.error("Wystąpił krytyczny błąd w aplikacji klienckiej:", error);
        rl.close();
    }
}

// Uruchomienie głównej pętli
main();
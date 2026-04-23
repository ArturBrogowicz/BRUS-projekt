import { ethers } from 'ethers';

async function grantPermissionAsAdmin() {
    // 1. Konfiguracja "Panelu Admina"
    // To jest klucz prywatny, którego nikomu nie podajemy. Używamy go tylko lokalnie do podpisu.
    const adminPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const adminWallet = new ethers.Wallet(adminPrivateKey);

    // 2. Co chcemy zrobić?
    const payload = {
        targetAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Klient Testowy
        table: "users",
        operation: "DELETE"
    };

    // 3. Generowanie bezpiecznego podpisu
    // Pro-tip: Dodajemy znacznik czasu (timestamp), aby haker nie mógł przechwycić
    // tej konkretnej wiadomości i wysłać jej ponownie jutro (tzw. Replay Attack).
    const timestamp = Date.now();
    const messageToSign = `Zatwierdzam nadanie uprawnien. Timestamp: ${timestamp}`;

    console.log(`Generowanie podpisu dla adresu: ${adminWallet.address}...`);
    const signature = await adminWallet.signMessage(messageToSign);

    // 4. Wysłanie HTTP POST
    console.log("Wysyłanie zabezpieczonego żądania do serwera...");
    const response = await fetch("http://localhost:3000/api/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...payload,
            message: messageToSign,
            signature: signature // Wysyłamy wygenerowany ciąg znaków (podpis)
        })
    });

    const data = await response.json();
    console.log("\nOtrzymana odpowiedź z serwera:");
    console.log(data);
}
async function revokePermissionAsAdmin() {
    // 1. Konfiguracja "Panelu Admina"
    const adminPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const adminWallet = new ethers.Wallet(adminPrivateKey);

    // 2. Co chcemy zrobić? (Odbieramy dokładnie to, co wcześniej nadaliśmy)
    const payload = {
        targetAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Klient Testowy
        table: "users",
        operation: "DELETE"
    };

    // 3. Generowanie bezpiecznego podpisu
    const timestamp = Date.now();
    // Zmieniamy treść wiadomości, by odpowiadała intencji akcji
    const messageToSign = `Zatwierdzam odebranie uprawnien. Timestamp: ${timestamp}`;

    console.log(`Generowanie podpisu dla adresu: ${adminWallet.address}...`);
    const signature = await adminWallet.signMessage(messageToSign);

    // 4. Wysłanie HTTP POST na endpoint /revoke
    console.log("Wysyłanie zabezpieczonego żądania do serwera (Odbieranie uprawnień)...");
    const response = await fetch("http://localhost:3000/api/admin/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...payload,
            message: messageToSign,
            signature: signature
        })
    });

    const data = await response.json();
    console.log("\nOtrzymana odpowiedź z serwera:");
    console.log(data);
}

// Uruchomienie wybranej funkcji:
grantPermissionAsAdmin();
// revokePermissionAsAdmin();
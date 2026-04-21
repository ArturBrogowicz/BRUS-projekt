import { ethers } from "hardhat";

async function main() {
    // Hardhat lokalnie dostarcza 20 gotowych kont testowych z wirtualnym ETH.
    // Pobieramy pierwsze trzy do różnych ról:
    const [deployerAdmin, proxyServer, testClient] = await ethers.getSigners();

    console.log("Rozpoczynam wdrożenie...");
    console.log("Konto Administratora (wdrażającego):", deployerAdmin.address);
    console.log("Konto Serwera Proxy (do zapisywania logów):", proxyServer.address);
    console.log("---------------------------------------------------");

    // 1. Wdrożenie kontraktu zarządzania uprawnieniami (DatabaseAccessControl)
    const AccessControl = await ethers.getContractFactory("DatabaseAccessControl");
    const accessControl = await AccessControl.deploy();

    await accessControl.waitForDeployment(); // Czekamy na wydobycie bloku
    const accessControlAddress = await accessControl.getAddress();
    console.log(`[SUKCES] DatabaseAccessControl wdrożony pod adresem: ${accessControlAddress}`);

    // 2. Wdrożenie kontraktu logów (AuditLog)
    // UWAGA: Do konstruktora przekazujemy adres naszego Serwera Proxy,
    // aby tylko on mógł używać funkcji logOperation!
    const AuditLog = await ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy(proxyServer.address);

    await auditLog.waitForDeployment();
    const auditLogAddress = await auditLog.getAddress();
    console.log(`[SUKCES] AuditLog wdrożony pod adresem: ${auditLogAddress}`);
    console.log("---------------------------------------------------");

    // 3. Wstępna konfiguracja - Nadanie przykładowych uprawnień
    console.log("Nadawanie testowych uprawnień dla klienta...");

    // Admin nadaje prawo dla `testClient` do robienia SELECT na tabeli "users"
    const tx = await accessControl.grantPermission(testClient.address, "users", "SELECT");
    await tx.wait(); // Czekamy na zapisanie transakcji w blockchainie

    console.log(`[SUKCES] Użytkownik ${testClient.address} otrzymał uprawnienie SELECT na tabeli 'users'.`);

    // Podsumowanie potrzebne do Twojego serwera w Node.js
    console.log("\n=== SKOPIUJ TO DO SWOJEGO PROXY W NODE.JS ===");
    console.log(`Adres AccessControl: "${accessControlAddress}"`);
    console.log(`Adres AuditLog: "${auditLogAddress}"`);
    console.log(`Klucz prywatny Proxy: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"`);
    // (Powyższy klucz prywatny to stały domyślny klucz dla konta #1 w lokalnej sieci Hardhat)
}

main().catch((error) => {
    console.error("Wystąpił błąd podczas wdrażania:", error);
    process.exitCode = 1;
});
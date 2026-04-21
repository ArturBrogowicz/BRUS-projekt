import express, { Request, Response } from 'express';
import { ethers } from 'ethers';

// 1. Ładowanie ABI wygenerowanych przez Hardhat z folderu artifacts
// Używamy 'require', aby uniknąć problemów z typowaniem JSON-ów w TS
const accessControlArtifact = require('../artifacts/contracts/DatabaseAccessControl.sol/DatabaseAccessControl.json');
const auditLogArtifact = require('../artifacts/contracts/AuditLog.sol/AuditLog.json');

const app = express();
app.use(express.json());

// 2. Konfiguracja połączenia z Blockchainem (Hardhat node)
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

// Klucz prywatny konta nr 1 (serwer proxy) z uruchomionego 'npx hardhat node'
const proxyPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const proxyWallet = new ethers.Wallet(proxyPrivateKey, provider);

// TUTAJ WKLEJ ADRESY ZE SKRYPTU WDROŻENIOWEGO
const ACCESS_CONTROL_ADDRESS =  "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const AUDIT_LOG_ADDRESS =  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// 3. Utworzenie instancji kontraktów
const accessControlContract = new ethers.Contract(
    ACCESS_CONTROL_ADDRESS,
    accessControlArtifact.abi,
    proxyWallet
);

const auditLogContract = new ethers.Contract(
    AUDIT_LOG_ADDRESS,
    auditLogArtifact.abi,
    proxyWallet
);

// 4. Testowy Endpoint naszego API
app.post('/api/query', async (req: Request, res: Response): Promise<any> => {
    try {
        const { userAddress, query, operationType, tableName } = req.body;

        console.log(`[PROXY] Otrzymano zapytanie od: ${userAddress}`);

        // KROK A: Weryfikacja Uprawnień (odczyt z blockchaina)
        const hasAccess = await accessControlContract.hasPermission(userAddress, tableName, operationType);

        if (!hasAccess) {
            console.log(`[PROXY] Odmowa dostępu.`);
            return res.status(403).json({ status: "error", message: "Brak uprawnień" });
        }

        console.log(`[PROXY] Dostęp przyznany. Zapisywanie logu...`);

        // KROK B: Zapis Logu na blockchainie (transakcja modyfikująca stan)
        // W prawdziwym kodzie zahashujesz tu 'query', dla testu wyślemy po prostu string "hash123"
        const tx = await auditLogContract.logOperation(userAddress, operationType, tableName, "przykladowyHashZapytania");
        const receipt = await tx.wait(); // Czekamy na wydobycie bloku!

        console.log(`[PROXY] Log zapisany w bloku nr: ${receipt.blockNumber}`);

        // KROK C: W tym miejscu w przyszłości przekażesz zapytanie do PostgreSQL
        // const dbResult = await pgClient.query(query);

        return res.json({
            status: "success",
            message: "Operacja autoryzowana i zalogowana w Blockchainie!",
            txHash: receipt.hash
        });

    } catch (error) {
        console.error("Wystąpił błąd w Proxy:", error);
        return res.status(500).json({ status: "error", message: "Błąd serwera" });
    }
});

const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Serwer Proxy uruchomiony na porcie ${PORT}`);
    try {
        // Asynchroniczne sprawdzenie połączenia z siecią (Ethers v6 bezpieczny sposób)
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        console.log(`📡 Połączono z siecią: ${network.name} (Aktualny blok: ${blockNumber})`);
    } catch (e) {
        console.log(`⚠️ Serwer działa, ale nie wykryto sieci Hardhat. Upewnij się, że 'npx hardhat node' jest włączone!`);
    }
});
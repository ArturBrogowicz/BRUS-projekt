import express, { Request, Response } from 'express';
import { ethers } from 'ethers';
import { parse, Statement } from 'pgsql-ast-parser';

// 1. Ładowanie ABI wygenerowanych przez Hardhat z folderu artifacts
const accessControlArtifact = require('../artifacts/contracts/DatabaseAccessControl.sol/DatabaseAccessControl.json');
const auditLogArtifact = require('../artifacts/contracts/AuditLog.sol/AuditLog.json');

const app = express();
app.use(express.json());

// 2. Konfiguracja połączenia z Blockchainem (Hardhat node)
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

// Klucz prywatny konta nr 1 (serwer proxy) z uruchomionego 'npx hardhat node'
const proxyPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const proxyWallet = new ethers.Wallet(proxyPrivateKey, provider);

// Klucz prywatny Konta #0 (Deployer Admin) z Hardhat
const adminPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

const ADMIN_PUBLIC_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// TUTAJ WKLEJ ADRESY ZE SKRYPTU WDROŻENIOWEGO
const ACCESS_CONTROL_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const AUDIT_LOG_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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

// Tworzymy instancję kontraktu z podpiętym portfelem Admina
const adminAccessControlContract = new ethers.Contract(
    ACCESS_CONTROL_ADDRESS,
    accessControlArtifact.abi,
    adminWallet
);

// Zaktualizowana funkcja rekurencyjna (odporna na specyfikę DELETE i UPDATE)
function extractAllTables(astNode: any): string[] {
    let tables = new Set<string>();

    if (!astNode || typeof astNode !== 'object') return [];

    // 1. Standardowy węzeł tabeli (głównie w SELECT i JOIN)
    if (astNode.type === 'table' && astNode.name) {
        if (typeof astNode.name === 'string') tables.add(astNode.name);
        else if (typeof astNode.name.name === 'string') tables.add(astNode.name.name);
    }

    // 2. Specyficzny przypadek dla INSERT INTO
    if (astNode.type === 'insert' && astNode.into && astNode.into.name) {
        if (typeof astNode.into.name === 'string') tables.add(astNode.into.name);
        else if (typeof astNode.into.name.name === 'string') tables.add(astNode.into.name.name);
    }

    // 3. Specyficzny przypadek dla DELETE FROM
    if (astNode.type === 'delete' && astNode.from && astNode.from.name) {
        if (typeof astNode.from.name === 'string') tables.add(astNode.from.name);
        else if (typeof astNode.from.name.name === 'string') tables.add(astNode.from.name.name);
    }

    // 4. Specyficzny przypadek dla UPDATE
    if (astNode.type === 'update' && astNode.table && astNode.table.name) {
        if (typeof astNode.table.name === 'string') tables.add(astNode.table.name);
        else if (typeof astNode.table.name.name === 'string') tables.add(astNode.table.name.name);
    }

    // Rekurencyjne przeszukiwanie reszty drzewa
    for (const key in astNode) {
        const value = astNode[key];
        if (typeof value === 'object' && value !== null) {
            const childTables = extractAllTables(value);
            childTables.forEach(t => tables.add(t));
        }
    }

    return Array.from(tables);
}

// 4. Endpoint naszego API
app.post('/api/query', async (req: Request, res: Response): Promise<any> => {
    try {
        const { userAddress, query } = req.body;
        console.log(`[PROXY] Otrzymano zapytanie od: ${userAddress}`);

        let ast: Statement[];
        try {
            // Rozbijamy SQL na drzewo logiczne
            ast = parse(query);
            if (!ast || ast.length === 0) {
                return res.status(400).json({ status: "error", message: "Puste zapytanie SQL" });
            }
        } catch (parseError) {
            console.error("Błąd parsowania SQL:", parseError);
            return res.status(400).json({ status: "error", message: "Nieprawidłowa składnia SQL." });
        }

        // Tabela do przechowywania zwalidowanych operacji (do późniejszego zlogowania)
        const authorizedOperations: { operation: string, table: string }[] = [];

        // KROK A: Walidacja za pomocą rekurencyjnego przeszukiwania
        for (const statement of ast) {
            const operationType = statement.type.toUpperCase();
            const involvedTables = extractAllTables(statement);

            if (involvedTables.length === 0) {
                continue; // Zapytanie bez tabeli (np. SELECT 1)
            }

            for (const tableName of involvedTables) {
                console.log(`[PROXY AST] Weryfikacja: ${operationType} na tabeli: ${tableName}`);
                console.log(userAddress, tableName, operationType);
                // Odpytujemy Smart Contract
                const hasAccess = await accessControlContract.hasPermission(userAddress, tableName, operationType);

                if (!hasAccess) {
                    console.log(`[PROXY] ❌ Odmowa dostępu dla: ${operationType} na ${tableName}`);
                    return res.status(403).json({
                        status: "error",
                        message: `Brak uprawnień do wykonania operacji ${operationType} na tabeli ${tableName}`
                    });
                }

                // Jeśli ma dostęp, dodajemy do listy do zlogowania
                authorizedOperations.push({ operation: operationType, table: tableName });
            }
        }

        console.log(`[PROXY] ✅ Dostęp przyznany do wszystkich zaangażowanych tabel. Zapisywanie logów...`);

        // KROK B: Zapis Logów na blockchainie
        const txHashes = [];

        // Zapisujemy log dla każdej tabeli z osobna.
        for (const authOp of authorizedOperations) {
            const tx = await auditLogContract.logOperation(
                userAddress,
                authOp.operation,
                authOp.table,
                "przykladowyHashZapytania" // Docelowo: np. ethers.keccak256(ethers.toUtf8Bytes(query))
            );
            const receipt = await tx.wait();

            console.log(`[PROXY] 📝 Log zapisany dla tabeli ${authOp.table} (Blok: ${receipt.blockNumber})`);
            txHashes.push(receipt.hash);
        }

        // KROK C: W tym miejscu w przyszłości przekażesz zapytanie do PostgreSQL
        // const dbResult = await pgClient.query(query);

        return res.json({
            status: "success",
            message: "Operacja autoryzowana i zalogowana w Blockchainie!",
            txHashes: txHashes // Zwracamy tablicę hashów transakcji
        });

    } catch (error) {
        console.error("Wystąpił błąd w Proxy:", error);
        return res.status(500).json({ status: "error", message: "Błąd serwera" });
    }
});

app.post('/api/admin/grant', async (req: Request, res: Response): Promise<any> => {
    try {
        // Oczekujemy teraz dodatkowo parametru message i signature
        const { targetAddress, table, operation, message, signature } = req.body;

        // --- 1. ZABEZPIECZENIE WEB3 (Weryfikacja Podpisu) ---
        if (!message || !signature) {
            return res.status(401).json({ status: "error", message: "Brak kryptograficznego podpisu (signature)." });
        }

        let recoveredAddress: string;
        try {
            // Serwer kryptograficznie sprawdza, kto podpisał tę wiadomość
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (e) {
            return res.status(400).json({ status: "error", message: "Nieprawidłowy format podpisu." });
        }

        // Porównujemy odzyskany adres z adresem naszego Admina
        if (recoveredAddress.toLowerCase() !== ADMIN_PUBLIC_ADDRESS.toLowerCase()) {
            console.log(`[ADMIN] ❌ Próba nieautoryzowanego dostępu od: ${recoveredAddress}`);
            return res.status(403).json({ status: "error", message: "Odmowa dostępu: Nie jesteś administratorem." });
        }

        // --- 2. WŁAŚCIWA LOGIKA (Wykonanie transakcji) ---
        console.log(`[ADMIN] 🔐 Uwierzytelnienie poprawne. Nadawanie: ${operation} na ${table} dla ${targetAddress}`);

        const tx = await adminAccessControlContract.grantPermission(targetAddress, table, operation);
        const receipt = await tx.wait();

        return res.json({
            status: "success",
            message: `Nadano uprawnienie ${operation} na tabeli ${table} dla adresu ${targetAddress}`,
            txHash: receipt.hash
        });

    } catch (error: any) {
        console.error("Błąd podczas nadawania uprawnień:", error);
        return res.status(500).json({ status: "error", message: "Błąd serwera." });
    }
});

// --- NOWY ENDPOINT ADMINISTRACYJNY ---
app.post('/api/admin/revoke', async (req: Request, res: Response): Promise<any> => {
    try {
        const { targetAddress, table, operation, message, signature } = req.body;

        // --- 1. ZABEZPIECZENIE WEB3 (Weryfikacja Podpisu) ---
        if (!message || !signature) {
            return res.status(401).json({ status: "error", message: "Brak kryptograficznego podpisu (signature)." });
        }

        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (e) {
            return res.status(400).json({ status: "error", message: "Nieprawidłowy format podpisu." });
        }

        if (recoveredAddress.toLowerCase() !== ADMIN_PUBLIC_ADDRESS.toLowerCase()) {
            console.log(`[ADMIN] ❌ Próba nieautoryzowanego dostępu od: ${recoveredAddress}`);
            return res.status(403).json({ status: "error", message: "Odmowa dostępu: Nie jesteś administratorem." });
        }

        // --- 2. WŁAŚCIWA LOGIKA (Wykonanie transakcji) ---
        console.log(`[ADMIN] 🔐 Uwierzytelnienie poprawne. Odbieranie: ${operation} na ${table} dla ${targetAddress}`);

        // Wywołujemy revokePermission na smart kontrakcie
        const tx = await adminAccessControlContract.revokePermission(targetAddress, table, operation);
        const receipt = await tx.wait();

        return res.json({
            status: "success",
            message: `Odebrano uprawnienie ${operation} na tabeli ${table} dla adresu ${targetAddress}`,
            txHash: receipt.hash
        });

    } catch (error: any) {
        console.error("Błąd podczas odbierania uprawnień:", error);
        return res.status(500).json({ status: "error", message: "Błąd serwera." });
    }
});

const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Serwer Proxy uruchomiony na porcie ${PORT}`);
    try {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        console.log(`📡 Połączono z siecią: ${network.name} (Aktualny blok: ${blockNumber})`);
    } catch (e) {
        console.log(`⚠️ Serwer działa, ale nie wykryto sieci Hardhat. Upewnij się, że 'npx hardhat node' jest włączone!`);
    }
});
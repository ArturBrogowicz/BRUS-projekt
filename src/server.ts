import express, { Request, Response } from 'express';
import { ethers } from 'ethers';
import { parse, Statement } from 'pgsql-ast-parser';
import { Pool } from 'pg';

const pgPool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'brus_db',
    password: 'beton',
    port: 5432,
});
pgPool.connect()
    .then(() => console.log("Connected to PostgreSQL database"))
    .catch(err => console.error("PostgreSQL connection error:", err));

const accessControlArtifact = require('../artifacts/contracts/DatabaseAccessControl.sol/DatabaseAccessControl.json');
const auditLogArtifact = require('../artifacts/contracts/AuditLog.sol/AuditLog.json');

const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

const proxyPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const proxyWallet = new ethers.Wallet(proxyPrivateKey, provider);

const adminPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

const ADMIN_PUBLIC_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const ACCESS_CONTROL_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const AUDIT_LOG_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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

const adminAccessControlContract = new ethers.Contract(
    ACCESS_CONTROL_ADDRESS,
    accessControlArtifact.abi,
    adminWallet
);

function extractAllTables(astNode: any): string[] {
    let tables = new Set<string>();

    if (!astNode || typeof astNode !== 'object') return [];

    if (astNode.type === 'table' && astNode.name) {
        if (typeof astNode.name === 'string') tables.add(astNode.name);
        else if (typeof astNode.name.name === 'string') tables.add(astNode.name.name);
    }

    if (astNode.type === 'insert' && astNode.into && astNode.into.name) {
        if (typeof astNode.into.name === 'string') tables.add(astNode.into.name);
        else if (typeof astNode.into.name.name === 'string') tables.add(astNode.into.name.name);
    }

    if (astNode.type === 'delete' && astNode.from && astNode.from.name) {
        if (typeof astNode.from.name === 'string') tables.add(astNode.from.name);
        else if (typeof astNode.from.name.name === 'string') tables.add(astNode.from.name.name);
    }

    if (astNode.type === 'update' && astNode.table && astNode.table.name) {
        if (typeof astNode.table.name === 'string') tables.add(astNode.table.name);
        else if (typeof astNode.table.name.name === 'string') tables.add(astNode.table.name.name);
    }

    for (const key in astNode) {
        const value = astNode[key];
        if (typeof value === 'object' && value !== null) {
            const childTables = extractAllTables(value);
            childTables.forEach(t => tables.add(t));
        }
    }

    return Array.from(tables);
}

app.post('/api/query', async (req: Request, res: Response): Promise<any> => {
    try {
        const { userAddress, query } = req.body;

        let ast: Statement[];
        try {
            ast = parse(query);
            if (!ast || ast.length === 0) {
                return res.status(400).json({ status: "error", message: "Empty SQL query" });
            }
        } catch (parseError) {
            console.error("SQL parsing error:", parseError);
            return res.status(400).json({ status: "error", message: "Invalid SQL syntax" });
        }

        const authorizedOperations: { operation: string, table: string }[] = [];

        for (const statement of ast) {
            const operationType = statement.type.toUpperCase();
            const involvedTables = extractAllTables(statement);

            if (involvedTables.length === 0) {
                continue;
            }

            for (const tableName of involvedTables) {
                const hasAccess = await accessControlContract.hasPermission(userAddress, tableName, operationType);

                if (!hasAccess) {
                    return res.status(403).json({
                        status: "error",
                        message: `Insufficient permissions to execute ${operationType} on table ${tableName}`
                    });
                }

                authorizedOperations.push({ operation: operationType, table: tableName });
            }
        }

        const txHashes = [];

        for (const authOp of authorizedOperations) {
            const tx = await auditLogContract.logOperation(
                userAddress,
                authOp.operation,
                authOp.table,
                "exampleQueryHash"
            );
            const receipt = await tx.wait();
            txHashes.push(receipt.hash);
        }

        const dbResult = await pgPool.query(query);

        return res.json({
            status: "success",
            message: "Operation authorized, logged in Blockchain, and executed in database",
            txHashes: txHashes,
            dbData: dbResult.rows,
            affectedRows: dbResult.rowCount
        });

    } catch (error) {
        console.error("Proxy error occurred:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.post('/api/admin/grant', async (req: Request, res: Response): Promise<any> => {
    try {
        const { targetAddress, table, operation, message, signature } = req.body;

        if (!message || !signature) {
            return res.status(401).json({ status: "error", message: "Missing cryptographic signature" });
        }

        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (e) {
            return res.status(400).json({ status: "error", message: "Invalid signature format" });
        }

        if (recoveredAddress.toLowerCase() !== ADMIN_PUBLIC_ADDRESS.toLowerCase()) {
            return res.status(403).json({ status: "error", message: "Access denied: Not an administrator" });
        }

        const tx = await adminAccessControlContract.grantPermission(targetAddress, table, operation);
        const receipt = await tx.wait();

        return res.json({
            status: "success",
            message: `Granted ${operation} permission on table ${table} for address ${targetAddress}`,
            txHash: receipt.hash
        });

    } catch (error: any) {
        console.error("Error granting permission:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

app.post('/api/admin/revoke', async (req: Request, res: Response): Promise<any> => {
    try {
        const { targetAddress, table, operation, message, signature } = req.body;

        if (!message || !signature) {
            return res.status(401).json({ status: "error", message: "Missing cryptographic signature" });
        }

        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (e) {
            return res.status(400).json({ status: "error", message: "Invalid signature format" });
        }

        if (recoveredAddress.toLowerCase() !== ADMIN_PUBLIC_ADDRESS.toLowerCase()) {
            return res.status(403).json({ status: "error", message: "Access denied: Not an administrator" });
        }

        const tx = await adminAccessControlContract.revokePermission(targetAddress, table, operation);
        const receipt = await tx.wait();

        return res.json({
            status: "success",
            message: `Revoked ${operation} permission on table ${table} for address ${targetAddress}`,
            txHash: receipt.hash
        });

    } catch (error: any) {
        console.error("Error revoking permission:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`Proxy server running on port ${PORT}`);
    try {
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        console.log(`Connected to network: ${network.name} (Current block: ${blockNumber})`);
    } catch (e) {
        console.error("Server running, but failed to connect to Ethereum network node.");
    }
});
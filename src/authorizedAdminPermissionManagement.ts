import { ethers } from 'ethers';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const API_BASE_URL = "http://localhost:3000/api/admin";

async function main() {
    const rl = readline.createInterface({ input, output });

    try {
        console.log("Available actions:");
        console.log("  [1] Grant permissions");
        console.log("  [2] Revoke permissions\n");

        let actionChoice = '';
        while (actionChoice !== '1' && actionChoice !== '2') {
            actionChoice = await rl.question('Select action number (1 or 2): ');
        }

        const isGranting = actionChoice === '1';
        const actionName = isGranting ? 'grant' : 'revoke';
        const endpoint = isGranting ? '/grant' : '/revoke';

        const targetAddress = await rl.question('1. Enter target address: ');
        const table = await rl.question('2. Enter table name: ');
        const operationInput = await rl.question('3. Enter operation (SELECT, INSERT, UPDATE, DELETE): ');

        const operation = operationInput.toUpperCase().trim();

        rl.close();

        const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY);
        const timestamp = Date.now();
        const messageToSign = `Approve permission ${actionName}. Timestamp: ${timestamp}`;

        const signature = await adminWallet.signMessage(messageToSign);

        const payload = {
            targetAddress: targetAddress.trim(),
            table: table.trim(),
            operation: operation,
            message: messageToSign,
            signature: signature
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.status === 'success') {
            console.log(`Success: ${data.message}`);
            if (data.txHash) console.log(`Transaction Hash: ${data.txHash}`);
        } else {
            console.log(`Error: ${data.message}`);
        }

    } catch (error) {
        console.error("Critical client application error:", error);
        rl.close();
    }
}

main();
# BRUS-projekt
Developing a zero-trust blockchain proxy integrated with a PostgreSQL database, featuring an AST (Abstract Syntax Tree) SQL parser and smart contract-based access control.

## Prerequisites
- Node.js (v18 or higher recommended)
- Docker Desktop (for running the local PostgreSQL database)

## Architecture Overview
1. **Client** sends an SQL query via HTTP POST.
2. **Node.js Proxy** parses the SQL using an AST to securely identify targeted tables and operations (preventing SQL injection and bypasses).
3. **Smart Contracts (Blockchain)** verify if the user has cryptographically granted permissions for that specific operation and table.
4. **AuditLog Contract** irreversibly logs the authorized operation on the blockchain.
5. **PostgreSQL Database** executes the query and returns the real data to the user.

---

## How to set up and run:

### 1. Project Initialization
Install all necessary packages and compile the smart contracts:
```bash
npm install
npx hardhat compile
```

### 2. Database Setup (PostgreSQL via Docker)
Start a local PostgreSQL instance using Docker:
```bash
docker run --name brus-postgres -e POSTGRES_PASSWORD=beton -e POSTGRES_DB=brus_db -p 5432:5432 -d postgres
```
Initialize the database with test tables (`users`, `beton`, `logs`). Open the database console:
```bash
docker exec -it brus-postgres psql -U postgres -d brus_db
```
Then, paste the following SQL commands to create tables and insert mock data:
```sql
CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100), status VARCHAR(50));
CREATE TABLE beton (id SERIAL PRIMARY KEY, type VARCHAR(50), status VARCHAR(50));
CREATE TABLE logs (id SERIAL PRIMARY KEY, action VARCHAR(255));

INSERT INTO users (name, status) VALUES ('Jan Kowalski', 'aktywny');
INSERT INTO beton (type, status) VALUES ('B20', 'planowany');
\q
```

### 3. Start Blockchain Network
Open a new terminal and start the local Hardhat node. **Leave this terminal active.**
```bash
npx hardhat node
```

### 4. Deploy Smart Contracts
Open a new terminal and run the deployment script to set up basic roles and deploy the contracts:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```
> ⚠️ **IMPORTANT:** After deployment, the console will output the new addresses for `DatabaseAccessControl` and `AuditLog`. Make sure to copy these addresses and update the constants in your `src/server.ts` file.

### 5. Start the Proxy Server
Run the Node.js proxy server. **Leave this terminal active.**
```bash
npx ts-node src/server.ts
```

### 6. Manage Permissions (Admin Panel)
Permissions cannot be granted freely. The system uses secure Web3 message signing (ECDSA) to authenticate the administrator. 
To grant or revoke access for specific users, run the interactive Admin CLI in a new terminal:
```bash
npx ts-node src/authorizedAdminPermissionManagement.ts
```
Follow the on-screen prompts to manage permissions (e.g., Grant `UPDATE` on table `beton` for your test user address).

### 7. Test the System (PowerShell)
Once permissions are granted, you can test the proxy. Send an HTTP POST request. Notice that you only need to send the SQL query — the AST parser handles the rest!

*Example of a data-modifying query (using RETURNING to get updated data back):*
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/query" -Method Post -Headers @{"Content-Type"="application/json"} -Body (@{
    userAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    query = "UPDATE beton SET status = 'wylany' WHERE id = 1 RETURNING *;"
} | ConvertTo-Json)
```
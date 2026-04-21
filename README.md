# BRUS-projekt
developing own blockchain proxy integrated with DB

## Prerequisites
- Node.js (v18 or higher recommended)

# How to set up and run:

1. Install packages - npm install
2. Compile contracts - npx hardhat compile
3. Start blockchain network - npx hardhat node (leave this terminal active)
4. Run example deployment script to set up basic roles and priviliges - npx hardhat run scripts/deploy.ts --network localhost
    IMPORTANT: After deployment, the console will output the new addresses for DatabaseAccessControl and AuditLog. Make sure to copy these addresses and update them in your src/server.ts
5. Start proxy server working - npx ts-node src/server.ts (leave this terminal active)
6. You can test proxy, just send HTTP POST request, for example - Invoke-RestMethod -Uri "http://localhost:3000/api/query" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"userAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "query": "SELECT * FROM users", "operationType": "SELECT", "tableName": "users"}'
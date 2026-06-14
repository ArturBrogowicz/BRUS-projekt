import { ethers } from "hardhat";

async function main() {
    const [deployerAdmin, proxyServer, testClient] = await ethers.getSigners();

    const AccessControl = await ethers.getContractFactory("DatabaseAccessControl");
    const accessControl = await AccessControl.deploy();
    await accessControl.waitForDeployment();
    const accessControlAddress = await accessControl.getAddress();
    console.log(`DatabaseAccessControl deployed to: ${accessControlAddress}`);

    const AuditLog = await ethers.getContractFactory("AuditLog");
    const auditLog = await AuditLog.deploy(proxyServer.address);
    await auditLog.waitForDeployment();
    const auditLogAddress = await auditLog.getAddress();
    console.log(`AuditLog deployed to: ${auditLogAddress}`);

    const tx = await accessControl.grantPermission(testClient.address, "users", "SELECT");
    await tx.wait();

    console.log(`Permission SELECT granted to ${testClient.address} on table 'users'.`);

    console.log(`AccessControlAddress: "${accessControlAddress}"`);
    console.log(`AuditLogAddress: "${auditLogAddress}"`);
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});
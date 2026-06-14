// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AuditLog {
    address public proxyServer;

    struct LogEntry {
        uint256 timestamp;
        address user;
        string operation;
        string table;
        string queryHash;
    }

    LogEntry[] public logs;

    event QueryLogged(
        uint256 indexed timestamp,
        address indexed user,
        string operation,
        string table,
        string queryHash
    );

    modifier onlyProxy() {
        require(msg.sender == proxyServer, "Only the Proxy server can log operations.");
        _;
    }

    constructor(address _proxyServer) {
        proxyServer = _proxyServer;
    }

    function logOperation(
        address user,
        string calldata operation,
        string calldata table,
        string calldata queryHash
    ) external onlyProxy {
        uint256 currentTimestamp = block.timestamp;

        logs.push(LogEntry({
            timestamp: currentTimestamp,
            user: user,
            operation: operation,
            table: table,
            queryHash: queryHash
        }));

        emit QueryLogged(currentTimestamp, user, operation, table, queryHash);
    }

    function getLogsCount() external view returns (uint256) {
        return logs.length;
    }

    function getLog(uint256 index) external view returns (
        uint256 timestamp,
        address user,
        string memory operation,
        string memory table,
        string memory queryHash
    ) {
        require(index < logs.length, "Log entry does not exist.");
        LogEntry memory entry = logs[index];
        return (entry.timestamp, entry.user, entry.operation, entry.table, entry.queryHash);
    }
}
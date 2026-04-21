// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AuditLog {
    // Adres serwera Proxy (tylko Proxy powinno móc dodawać logi)
    address public proxyServer;

    // Struktura pojedynczego logu (opcjonalne, do zapisu w stanie)
    struct LogEntry {
        uint256 timestamp;
        address user;
        string operation;
        string table;
        string queryHash; // Hash zapytania SQL z Node.js
    }

    // Tablica przechowująca historię (metoda 1 - łatwa do odczytu z poziomu kodu)
    LogEntry[] public logs;

    // Zdarzenie logowania (metoda 2 - best practice, zapis do logów EVM)
    // Używamy 'indexed' przy użytkowniku i dacie, by łatwo filtrować logi w ethers.js
    event QueryLogged(
        uint256 indexed timestamp,
        address indexed user,
        string operation,
        string table,
        string queryHash
    );

    // Zabezpieczenie: tylko autoryzowane Proxy może wrzucać logi do bazy
    modifier onlyProxy() {
        require(msg.sender == proxyServer, "Tylko serwer Proxy moze zapisywac logi.");
        _;
    }

    // Konstruktor przyjmuje adres serwera Proxy (np. adres portfela używanego w ethers.js)
    constructor(address _proxyServer) {
        proxyServer = _proxyServer;
    }

    // Główna funkcja wywoływana przez Proxy po udanej weryfikacji uprawnień
    function logOperation(
        address user,
        string calldata operation,
        string calldata table,
        string calldata queryHash
    ) external onlyProxy {

        uint256 currentTimestamp = block.timestamp;

        // 1. Zapis do tablicy (Stan Kontraktu)
        logs.push(LogEntry({
            timestamp: currentTimestamp,
            user: user,
            operation: operation,
            table: table,
            queryHash: queryHash
        }));

        // 2. Emisja zdarzenia (Logi EVM)
        emit QueryLogged(currentTimestamp, user, operation, table, queryHash);
    }

    // Funkcja pomocnicza do pobrania całkowitej liczby logów
    function getLogsCount() external view returns (uint256) {
        return logs.length;
    }

    // Funkcja do pobrania konkretnego logu (przydatne przy budowie panelu admina)
    function getLog(uint256 index) external view returns (
        uint256 timestamp,
        address user,
        string memory operation,
        string memory table,
        string memory queryHash
    ) {
        require(index < logs.length, "Log nie istnieje.");
        LogEntry memory entry = logs[index];
        return (entry.timestamp, entry.user, entry.operation, entry.table, entry.queryHash);
    }
}
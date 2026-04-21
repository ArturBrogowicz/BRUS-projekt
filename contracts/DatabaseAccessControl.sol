// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DatabaseAccessControl {
    // Adres administratora (np. konto, które wdraża kontrakt)
    address public admin;

    // Zagnieżdżone mapowanie: Adres Użytkownika -> Tabela -> Operacja -> Czy ma dostęp (true/false)
    // Przykład: 0x123... -> "users" -> "SELECT" -> true
    mapping(address => mapping(string => mapping(string => bool))) private permissions;

    // Zdarzenia (Events) - ułatwiają śledzenie zmian uprawnień poza blockchainem
    event PermissionGranted(address indexed user, string table, string operation);
    event PermissionRevoked(address indexed user, string table, string operation);

    // Modyfikator dostępu - tylko admin może nadawać/odbierać uprawnienia
    modifier onlyAdmin() {
        require(msg.sender == admin, "Tylko administrator moze to zrobic.");
        _;
    }

    constructor() {
        // Ustawia twórcę kontraktu jako administratora
        admin = msg.sender;
    }

    // Funkcja do nadawania uprawnień (wywoływana przez Admina)
    function grantPermission(address user, string calldata table, string calldata operation) external onlyAdmin {
        permissions[user][table][operation] = true;
        emit PermissionGranted(user, table, operation);
    }

    // Funkcja do odbierania uprawnień (wywoływana przez Admina)
    function revokePermission(address user, string calldata table, string calldata operation) external onlyAdmin {
        permissions[user][table][operation] = false;
        emit PermissionRevoked(user, table, operation);
    }

    // Funkcja weryfikująca uprawnienia (wywoływana przez Proxy)
    // Słowo kluczowe 'view' oznacza, że odczyt jest natychmiastowy i darmowy
    function hasPermission(address user, string calldata table, string calldata operation) external view returns (bool) {
        return permissions[user][table][operation];
    }

    // Opcjonalnie: Przekazanie uprawnień admina komuś innemu
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Niepoprawny adres.");
        admin = newAdmin;
    }
}
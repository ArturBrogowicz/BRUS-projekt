// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DatabaseAccessControl {
    address public admin;

    mapping(address => mapping(string => mapping(string => bool))) private permissions;

    event PermissionGranted(address indexed user, string table, string operation);
    event PermissionRevoked(address indexed user, string table, string operation);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only the administrator can perform this action.");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function grantPermission(address user, string calldata table, string calldata operation) external onlyAdmin {
        permissions[user][table][operation] = true;
        emit PermissionGranted(user, table, operation);
    }

    function revokePermission(address user, string calldata table, string calldata operation) external onlyAdmin {
        permissions[user][table][operation] = false;
        emit PermissionRevoked(user, table, operation);
    }

    function hasPermission(address user, string calldata table, string calldata operation) external view returns (bool) {
        return permissions[user][table][operation];
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address.");
        admin = newAdmin;
    }
}
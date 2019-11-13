pragma solidity ^0.5.5;

import "./Assert.sol";

contract PermissionsLevel {

    uint16 constant public canSpend = 1 << 0;

    uint16 constant public canUnfreeze = 1 << 1;
    uint16 constant public canChangeParticipants = 1 << 2;

    uint16 constant public canChangeBypass = 1 << 3;

    // There participant that can sign a boost operation can use its permissions with a higher level by co-signing
    uint16 constant public canSignBoosts = 1 << 4;
    uint16 constant public canExecuteBoosts = 1 << 5;

    // Instant Run Permissions - these actions do not require delays
    uint16 constant public canFreeze = 1 << 6;
    uint16 constant public canCancelConfigChanges = 1 << 7;
    uint16 constant public canCancelSpend = 1 << 8;
    uint16 constant public canApprove = 1 << 9;
    uint16 constant public canAddOperator = 1 << 10;

    uint16 public canChangeConfig = canUnfreeze | canChangeParticipants /*| canChangeOwner*/ /* | canChangeDelays */;
    uint16 public canCancel = canCancelSpend | canCancelConfigChanges;

    uint16 public ownerPermissions = canSpend | canCancel | canFreeze | canChangeConfig | canSignBoosts | canAddOperator | canChangeBypass;
    uint16 public adminPermissions = /*canChangeOwner |*/ canExecuteBoosts;
    uint16 public watchdogPermissions = canCancel | canFreeze;

    function comparePermissions(uint16 neededPermissions, uint16 senderPermissions) view internal {
        uint16 missingPermissions = neededPermissions & (senderPermissions ^ uint16(- 1));
        string memory error = Assert.concat("permissions missing: ", missingPermissions);
        require(missingPermissions == 0, error);
        require(missingPermissions < 0x07FF, "permissions overflow"); // TODO: increase size of perm+level to drop this packing/unpacking hell
        require(
            senderPermissions == ownerPermissions ||
            senderPermissions == adminPermissions ||
            senderPermissions == watchdogPermissions,
            "use defaults or go compile your vault from sources");

    }

    // TODO: increase size
    function extractPermissionLevel(uint16 permLev) pure internal returns (uint16 permissions, uint8 level) {
        permissions = permLev & 0x07FF;
        // 0xFFFF >> 5
        level = uint8(permLev >> 11);
        // 32 levels ought to be enough for anybody©
    }

    function extractLevel(uint16 permLev) pure internal returns (uint8 level) {
        (, level) = extractPermissionLevel(permLev);
    }

    function extractPermission(uint16 permLev) pure internal returns (uint16 permission) {
        (permission,) = extractPermissionLevel(permLev);
    }

    function packPermissionLevel(uint16 permissions, uint8 level) pure internal returns (uint16 permLev) {
        require(permissions <= 0x07FF, "permissions overflow");
        require(level <= 0x1F, "level overflow");
        return (uint16(level) << 11) + permissions;
    }


}

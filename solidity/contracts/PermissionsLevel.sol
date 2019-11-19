pragma solidity ^0.5.10;

import "./Assert.sol";

contract PermissionsLevel {

    uint32 constant public canSpend = 1 << 0;

    uint32 constant public canUnfreeze = 1 << 1;
    uint32 constant public canChangeParticipants = 1 << 2;

    uint32 constant public canChangeBypass = 1 << 3;

    // There participant that can sign a boost operation can use its permissions with a higher level by co-signing
    uint32 constant public canSignBoosts = 1 << 4;
    uint32 constant public canExecuteBoosts = 1 << 5;

    // Instant Run Permissions - these actions do not require delays
    uint32 constant public canFreeze = 1 << 6;
    uint32 constant public canCancelConfigChanges = 1 << 7;
    uint32 constant public canCancelSpend = 1 << 8;
    uint32 constant public canApprove = 1 << 9;
    uint32 constant public canAddOperator = 1 << 10;

    uint32 constant public canExecuteBypassCall = 1 << 11;
    uint32 constant public canCancelBypassCall = 1 << 12;

    uint32 public canChangeConfig = canUnfreeze | canChangeParticipants /*| canChangeOwner*/ /* | canChangeDelays */;
    uint32 public canCancel = canCancelSpend | canCancelConfigChanges | canCancelBypassCall;

    uint32 public ownerPermissions = canSpend | canCancel | canFreeze | canChangeConfig | canSignBoosts | canAddOperator | canChangeBypass | canExecuteBypassCall;
    uint32 public adminPermissions = /*canChangeOwner |*/ canExecuteBoosts | canAddOperator | canApprove;
    uint32 public watchdogPermissions = canCancel | canFreeze;

//    function comparePermissions(uint16 neededPermissions, uint16 senderPermissions) view internal {
//        uint16 missingPermissions = neededPermissions & (senderPermissions ^ uint16(- 1));
//        string memory error = Assert.concat("permissions missing: ", missingPermissions);
//        require(missingPermissions == 0, error);
//        require(missingPermissions < 0x07FF, "permissions overflow"); // TODO: increase size of perm+level to drop this packing/unpacking hell
//        require(
//            senderPermissions == ownerPermissions ||
//            senderPermissions == adminPermissions ||
//            senderPermissions == watchdogPermissions,
//            "use defaults or go compile your vault from sources");
//
//    }

    function comparePermissions(uint32 neededPermissions, uint32 senderPermissions) view internal {
        uint32 missingPermissions = neededPermissions & (senderPermissions ^ uint32(- 1));
        string memory error = Assert.concat("permissions missing: ", missingPermissions);
        require(missingPermissions == 0, error);
        require(missingPermissions < 0x07FFFFFF, "permissions overflow"); // TODO: increase size of perm+level to drop this packing/unpacking hell
        require(
            senderPermissions == ownerPermissions ||
            senderPermissions == adminPermissions ||
            senderPermissions == watchdogPermissions,
            "use defaults or go compile your vault from sources");

    }

    // TODO: increase size
//    function extractPermissionLevel(uint16 permLev) pure internal returns (uint16 permissions, uint8 level) {
//        permissions = permLev & 0x07FF;
//        // 0xFFFF >> 5
//        level = uint8(permLev >> 11);
//        // 32 levels ought to be enough for anybody©
//    }

    function extractLevel(uint32 permLev) pure internal returns (uint8 level) {
        (, level) = extractPermissionLevel(permLev);
    }

    function extractPermission(uint32 permLev) pure internal returns (uint32 permission) {
        (permission,) = extractPermissionLevel(permLev);
    }

//    function packPermissionLevel(uint16 permissions, uint8 level) pure internal returns (uint16 permLev) {
//        require(permissions <= 0x07FF, "permissions overflow");
//        require(level <= 0x1F, "level overflow");
//        return (uint16(level) << 11) + permissions;
//    }

    function packPermissionLevel(uint32 permissions, uint8 level) pure internal returns (uint32 permLev) {
        require(permissions <= 0x07FFFFFF, "permissions overflow");
        require(level <= 0x1F, "level overflow");
        return (uint32(level) << 27) + permissions;
    }

    function extractPermissionLevel(uint32 permLev) public pure returns(uint32 permissions, uint8 level) {
        permissions = permLev & 0x07FFFFFF;
        level = uint8(permLev >> 27);
    }


}

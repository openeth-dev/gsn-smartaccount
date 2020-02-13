pragma solidity ^0.5.10;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

library Utilities {
    using ECDSA for bytes32;
    using LibBytes for bytes;
    function changeHash(uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(actions, args1, args2, stateId));
    }

    function transactionHash(
        uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId,
        address sender, uint32 senderPermsLevel,
        address booster, uint32 boosterPermsLevel)
    internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(actions, args1, args2, stateId, sender, senderPermsLevel, booster, boosterPermsLevel));
    }

    function encodeParticipant(address participant, uint32 permsLevel) internal pure returns (bytes32) {
        (uint32 permissions, uint8 level) = extractPermissionLevel(permsLevel);
        return encodeParticipant(participant, permissions, level);
    }

    function encodeParticipant(address participant, uint32 permissions, uint8 level) internal pure returns (bytes32) {
        return abi.encodePacked(participant, permissions, level, uint56(0)).readBytes32(0);
    }

    function decodeParticipant(bytes32 participantId) public pure returns (address, uint32, uint8){
        address participant = address(uint256(participantId) >> 96);
        uint32 permissions = uint32(uint256(participantId) >> 64) & 0x07FFFFFF;
        uint8 level = uint8(uint256(participantId)  >> 56);
        return (participant, permissions, level);
    }

    function recoverConfigSigner(uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId, bytes memory signature) public pure returns (address){
        return changeHash(actions, args1, args2, stateId).toEthSignedMessageHash().recover(signature);
    }

    function bypassCallHash(uint256 stateNonce, address sender, uint32 senderPermsLevel, address target, uint256 value, bytes memory msgdata) public pure returns (bytes32){
        return keccak256(abi.encodePacked(stateNonce, sender, senderPermsLevel, target, value, msgdata));
    }

    // ALEXF: I believe part of shrinking the SmartAccount code size is to move as much code out as possible
    // ALEXF: PermissionLevel library is a good start
    function extractPermissionLevel(uint32 permsLevel) public pure returns (uint32 permissions, uint8 level) {
        permissions = permsLevel & 0x07FFFFFF;
        level = uint8(permsLevel >> 27);
    }

}

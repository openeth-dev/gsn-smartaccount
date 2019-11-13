pragma solidity ^0.5.5;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

library Utilities {
    using ECDSA for bytes32;
    function changeHash(uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(actions, args1, args2, stateId));
    }

    function transactionHash(
        uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId,
        address sender, uint16 senderPermsLevel,
        address booster, uint16 boosterPermsLevel)
    internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(actions, args1, args2, stateId, sender, senderPermsLevel, booster, boosterPermsLevel));
    }

    function transactionHashPublic(
        uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId,
        address sender, uint16 senderPermsLevel,
        address booster, uint16 boosterPermsLevel)
    public pure returns (bytes32) {
        return transactionHash(actions, args1, args2, stateId, sender, senderPermsLevel, booster, boosterPermsLevel);
    }

    function participantHash(address participant, uint16 permsLevel) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(participant, permsLevel));
    }

    function vaultTransferHash(address sender, uint256 scheduledNonce, uint256 delay, address destination, uint256 value, address token) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sender, scheduledNonce, delay, destination, value, token));
    }

    function recoverConfigSigner(uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 stateId, bytes memory signature) public pure returns (address){
        return changeHash(actions, args1, args2, stateId).toEthSignedMessageHash().recover(signature);
    }

    function bypassCallHash(uint256 stateNonce, address sender, uint16 senderPermsLevel, address target, uint256 value, bytes memory msgdata) public pure returns (bytes32){
        return keccak256(abi.encodePacked(stateNonce, sender, senderPermsLevel, target, value, msgdata));
    }


}

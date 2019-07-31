pragma solidity ^0.5.5;

library Utilities {
    function changeHash(uint8[] memory actions, bytes32[] memory args, uint256 stateId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(actions, args, stateId));
    }


    function transactionHash(
        uint8[] memory actions, bytes32[] memory args, uint256 stateId,
        address sender, uint16 senderPermsLevel,
        address booster, uint16 boosterPermsLevel)
    public pure returns (bytes32) {
        return keccak256(abi.encodePacked(actions, args, stateId, sender, senderPermsLevel, booster, boosterPermsLevel));
    }

    function participantHash(address participant, uint16 permsLevel) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(participant, permsLevel));
    }
}

pragma solidity ^0.5.8;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";

/**
 * Base contract for delayed operations.
 */
contract DelayedOps {

    uint256 public opsNonce = 0;
    uint constant EOF = uint(- 1);
    mapping(bytes32 => uint) pending;

    event DelayedOperation(bytes batchMetadata, uint256 opsNonce, bytes operation, uint dueTime);
    event DelayedOperationCancelled(address sender, bytes32 hash);

    /**
     * Implementations must validate that given operation is allowed to proceed or revert otherwise.
     */
    function validateOperation(bytes memory batchMetadata, bytes memory singleOp) internal;

    function delayedOpHash(bytes memory batchMetadata, uint nonce, bytes memory batch) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(batchMetadata, nonce, batch));
    }

    /*
     * @param batchMetadata - free-form data that can be used by the 'validateOperation' implementation to
     *      decide if the operation is valid or not; may include sender address, permissions, timestamps etc.
     * @param nonce - used to differentiate identical transactions
     */
    function scheduleDelayedBatch(bytes memory batchMetadata, uint delayTime, bytes memory batch) internal {

        require(delayTime > 0, "validateOperation: should have positive delayTime");
        bytes32 hash = delayedOpHash(batchMetadata, opsNonce, batch);
        require(pending[hash] == 0, "repeated delayed op");
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        emit DelayedOperation(batchMetadata, opsNonce, batch, dueTime);
        opsNonce = opsNonce + 1;
    }

    function cancelDelayedOp(bytes32 hash) internal {
        require(pending[hash] > 0, "cannot cancel, operation does not exist");
        delete pending[hash];
        emit DelayedOperationCancelled(msg.sender, hash);
    }

    /**
     * Applies operations one-by-one. Values can be taken directly from the DelayedOperation event.
     */
    function applyDelayedOps(bytes memory batchMetadata, uint256 nonce, bytes memory batch) internal {
        bytes32 hash = delayedOpHash(batchMetadata, nonce, batch);
        uint dueTime = pending[hash];
        require(dueTime != 0, "applyDelayedOps called for non existing delayed op");
        require(now > dueTime, "applyDelayedOps called before due time");

        // break up the batch into separate method calls, validated and execute each one separately
        uint pos = 0;
        while (pos != EOF) {
            bytes memory singleOp;
            (singleOp, pos) = nextParam(batch, pos);
            validateOperation(batchMetadata, singleOp);
            bool success;
            bytes memory revertMsg;
            (success, revertMsg) = address(this).call(singleOp);
            require(success, string(revertMsg));
        }
    }

    function nextParam(bytes memory batch, uint pos) public pure returns (bytes memory ret, uint nextPos) {
        require(pos >= 0 && pos < batch.length, "pos out of range");
        ret = LibBytes.readBytesWithLength(batch, pos);
        nextPos = pos + 32 + ret.length;
        if (nextPos == batch.length) {
            nextPos = EOF;
        }
    }

    function encodeDelayed(bytes memory delayedTransaction) public pure returns (bytes memory){
        return abi.encodePacked(delayedTransaction.length, delayedTransaction);
    }

}

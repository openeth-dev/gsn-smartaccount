pragma solidity ^0.5.8;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";

/**
 * Base contract for delayed operations.
 * a delayed operation is a function where first parameter is its original sender,
 */
contract DelayedOps {

    uint256 opsNonce = 0;

    function getNonce() public view returns (uint) {return opsNonce;}

    event DelayedOperation(bytes batchMetadata, uint256 opsNonce, bytes operation, uint dueTime);
    event DelayedOperationCancelled(address sender, bytes32 hash);

    /**
     * Template method: validate the sender is allowed to make this operation.
     * most likely, only the selector (first 4 bytes) are checked.
     * return the required delay to apply the operation.
     * revert if the sender is not allowed to make the operation.
     */
    function validateOperation(bytes memory batchMetadata, bytes memory singleOp) internal;

    function delayedOpHash(bytes memory batchMetadata, uint nonce, bytes memory batch) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(batchMetadata, nonce, batch));
    }

    function scheduleDelayedBatch(bytes memory batchMetadata, uint delayTime, bytes memory batch) internal {

        require(delayTime > 0, "validateOperation: should have positive delayTime");
        bytes32 hash = delayedOpHash(batchMetadata, opsNonce, batch);
        //make sure we don't resend the same operation
        require(pending[hash] == 0, "repeated delayed op");
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        emit DelayedOperation(batchMetadata, opsNonce, batch, dueTime);
        // Note: Must be the last thing. Cannot be first, as 'getNonce' should return the value that will be used next.
        opsNonce = opsNonce + 1;
    }

    function cancelDelayedOp(bytes32 hash) internal {
        require(pending[hash] > 0, "cannot cancel, operation does not exist");
        delete pending[hash];
        emit DelayedOperationCancelled(msg.sender, hash);
    }

    /**
     * call operations to apply.
     * values are taken directly from the DelayedOperation event
     * actual caller of this method is not checked: the first parameter of the operation is the original sender
     * (which was verified by sendDelayedOp), and only it should be validated.
     */
    function applyDelayedOps(bytes memory batchMetadata, uint256 nonce, bytes memory batch) internal {
        bytes32 hash = delayedOpHash(batchMetadata, nonce, batch);
        uint dueTime = pending[hash];
        require(dueTime != 0, "applyDelayedOps called for non existing delayed op");
        require(now > dueTime, "applyDelayedOps called before due time");

        //break operation (batch) into separate operations. each is validated separately.
        // each operation start with "len" in uint (32-byte blocks)

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

    //TODO: test for this method separately
    function nextParam(bytes memory batch, uint pos) public pure returns (bytes memory ret, uint nextPos) {
        require(pos >= 0 && pos < batch.length, "pos out of range");
        uint len = LibBytes.readUint256(batch, pos);
        require(len > 0 && pos + len <= batch.length, "invalid length in block");
        ret = getBytes(batch, pos + 32, len);
        nextPos = pos + 32 + len;
        if (nextPos == batch.length) {
            nextPos = EOF;
        }
    }

    uint constant EOF = uint(- 1);

    function getBytes(bytes memory buf, uint pos, uint len) public pure returns (bytes memory) {
        bytes memory ret = new bytes(len);
        for (uint i = 0; i < len; i++) {
            ret[i] = buf[i + pos];
        }
        return ret;
    }

    event debug(uint due, uint timeNow);

    mapping(bytes32 => uint) pending;

    function encodeDelayed(bytes memory delayedTransaction) public pure returns (bytes memory){
        return abi.encodePacked(delayedTransaction.length, delayedTransaction);
    }

}

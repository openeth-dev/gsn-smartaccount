pragma solidity ^0.5.8;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";

/**
 * Base contract for delayed operations.
 * a delayed operation is a function where first parameter is its original sender,
 */
contract DelayedOps {

    uint256 opsNonce = 0;

    function getNonce() public view returns (uint) {return opsNonce;}

    event DelayedOperation(address sender, uint256 extraData, uint256 opsNonce, bytes operation, uint dueTime);
    event DelayedOperationCancelled(address sender, bytes32 hash);

    /**
     * Template method: validate the sender is allowed to make this operation.
     * most likely, only the selector (first 4 bytes) are checked.
     * return the required delay to apply the operation.
     * revert if the sender is not allowed to make the operation.
     */
    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal;

    function delayedOpHash(address sender, uint256 extraData, uint nonce, bytes memory batch) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sender, nonce, batch));
    }

    function scheduleDelayedBatch(address sender, uint256 extraData, uint delayTime, uint nonce, bytes memory batch) internal {

        require(nonce == getNonce(), "Wrong nonce");
        require(delayTime > 0, "validateOperation: should return positive delayTime");
        bytes32 hash = delayedOpHash(sender, extraData, nonce, batch);
        //make sure we don't resend the same operation
        require(pending[hash] == 0, "repeated delayed op");
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        opsNonce = opsNonce + 1;

        emit DelayedOperation(sender, extraData, nonce, batch, dueTime);
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
    function applyDelayedOps(address sender, uint256 extraData, uint256 nonce, bytes memory batch) internal {
        bytes32 hash = delayedOpHash(sender, extraData, nonce, batch);
        uint dueTime = pending[hash];
        require(dueTime != 0, "applyDelayedOps called for non existing delayed op");
        require(now > dueTime, "applyDelayedOps called before due time");

        //break operation (batch) into separate operations. each is validated separately.
        // each operation start with "len" in uint (32-byte blocks)

        uint pos = 0;
        while (pos != EOF) {
            bytes memory singleOp;
            (singleOp, pos) = nextParam(batch, pos);
            //NOTE: decode doesn't work for methods with no args. but we know all our methods DO have args...
            bytes4 methodSig = LibBytes.readBytes4(singleOp, 0);
            validateOperation(sender, extraData, methodSig);
            bool success;
            bytes memory revertMsg;
            (success, revertMsg) = address(this).call(singleOp);
            require(success, string(revertMsg));
        }
    }

    //TODO: test for this method separately
    function nextParam(bytes memory batch, uint pos) public pure returns (bytes memory ret, uint nextPos) {
        require(pos >= 0 && pos < batch.length, "pos out of range");
        uint len = uint(getBytes32(batch, pos));
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

    function getBytes32(bytes memory b, uint ofs) pure internal returns (bytes32) {
        return bytes32(LibBytes.readUint256(b, ofs));
    }

    function getAddress(bytes memory b, uint ofs) pure internal returns (address) {
        return address(LibBytes.readUint256(b, ofs));
    }
}

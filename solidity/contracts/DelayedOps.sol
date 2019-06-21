pragma solidity ^0.5.8;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";

/**
 * Base contract for delayed operations.
 * a delayed operation is a function where first parameter is its original sender,
 */
contract DelayedOps {

    uint256 opsNonce = 0;
    function getNonce() public view returns(uint) { return opsNonce; }

    event DelayedOperation(address sender, uint256 opsNonce, bytes operation, uint dueTime);
    event DelayedOperationCancelled(address sender, bytes32 hash);

    //easy modifier to make a method dual-purpose:
    //call from external source will save as delayed op.
    //later, applyDelayedOp will attempt to call it again to execute the delayed operation.
    // call from local another method (sender==this) can only be from applyDelayedOp, to actually run it.
    modifier delayed_operation() {
        if (msg.sender != address(this)) {
            sendDelayedOp(msg.data);
            return;
        }
        _;
    }

    /**
     * Template method: validate the sender is allowed to make this operation.
     * most likely, only the selector (first 4 bytes) are checked.
     * return the required delay to apply the operation.
     * revert if the sender is not allowed to make the operation.
     */
    function validateOperation(address sender, uint256 delay, bytes4 methodSig) internal;

    /**
     * send a single delayed operation. 
     * @param operation - the delayed operation. MUST have the first parameter set to "sender"
     * usage:
     * (note that it can't be called directly, but wrapped by the contract should have a method:
     * 
     *  myContract.sendDelayedOp(
     *      myContract.addParticipant(myAddr,myRank,participant).encodeAbi(),
     *      { from:myAddr }
     *  )
     */
    function sendDelayedOp(bytes memory operation) internal {
        //can't be a valid operation: must have (at least) one argument..
        require(operation.length >= 4 + 20 + 32, "invalid delayed op: not enough arguments");

        require(msg.sender == getAddress(operation, 4), "wrong sender for delayed op");
        uint256 delayTime = uint256(getBytes32(operation, 32 + 4));
        //        uint delayTime = validateOperation(msg.sender, operation);
        validateOperation(msg.sender, delayTime, getBytes4(operation, 0));
        require(delayTime > 0, "validateOperation: should provide positive delayTime");
        bytes32 hash = keccak256(abi.encodePacked(operation, opsNonce));
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        emit DelayedOperation(msg.sender, opsNonce, operation, dueTime);
        opsNonce = opsNonce + 1;
    }

    function delayedOpHash(address sender, uint nonce, bytes memory batch) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sender, nonce, batch));
    }

    function scheduleDelayedOp(address sender, uint delayTime, uint nonce, bytes memory batch) internal {

        require(nonce == getNonce(), "Wrong nonce");
        require(delayTime > 0, "validateOperation: should return positive delayTime");
        bytes32 hash = delayedOpHash(sender, nonce, batch);
        //make sure we don't resend the same operation
        require(pending[hash] == 0, "repeated delayed op");
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        opsNonce = opsNonce + 1;

        emit DelayedOperation(sender, nonce, batch, dueTime);
    }

    function cancelDelayedOp(bytes32 hash) internal {
        require(pending[hash] > 0, "cannot cancel, operation does not exist");
        delete pending[hash];
        emit DelayedOperationCancelled(msg.sender, hash);
    }

    /**
     * call an operation to apply. values are taken from the DelayedOperation event
     * actuall caller of this method is not checked: the first parameter of the operatio is the original sender
     * (which was verified by sendDelayedOp), and only it should be validated.
     */
    function applyDelayedOp(bytes memory operation, uint256 nonce) internal {
        bytes32 hash = keccak256(abi.encodePacked(operation, nonce));
        uint dueTime = pending[hash];
        require(dueTime != 0, "applyDelayedOp called for non existing delayed op");
        require(now > dueTime, "applyDelayedOp called before due time");

        emit debug(dueTime, now);
        bool success;
        bytes memory returnVal = "applyDelayedOp: operation reverted";
        (success, returnVal) = address(this).call(operation);
        require(success, string(returnVal));
    }

    /**
     * call operations to apply.
     * values are taken directly from the DelayedOperation event
     * actuall caller of this method is not checked: the first parameter of the operation is the original sender
     * (which was verified by sendDelayedOp), and only it should be validated.
     */
    function applyDelayedOps(address sender, uint256 nonce, bytes memory batch) internal {
        bytes32 hash = delayedOpHash(sender, nonce, batch);
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
            validateOperation(sender, 777, methodSig);
            bool success;
            bytes memory revert;
//            (success,) = address(this).call(singleOp);
//            require(success, "applyDelayedOps: operation reverted");
            (success, revert) = address(this).call(singleOp);
            require(success, string(revert));
        }
    }

    function nextParam(bytes memory batch, uint pos) public pure returns (bytes memory ret, uint nextPos) {
        require(pos >= 0 && pos < batch.length, "pos out of range");
        uint len = uint(getBytes32(batch, pos));
        require(len > 0 && pos + len <= batch.length, "invalid length in block");
        ret = getBytes(batch, pos + 32, pos + len);
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


    function getBytes4(bytes memory b, uint ofs) pure internal returns (bytes4) {
        return bytes4(getBytes32(b, ofs));
    }

    function getBytes32(bytes memory b, uint ofs) pure internal returns (bytes32) {
        return bytes32(LibBytes.readUint256(b, ofs));
    }

    function getAddress(bytes memory b, uint ofs) pure internal returns (address) {
        return address(LibBytes.readUint256(b, ofs));
    }
}

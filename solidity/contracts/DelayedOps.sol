pragma solidity ^0.5.8;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";

/**
 * Base contract for delayed operations.
 * a delayed operation is a function where first parameter is its original sender,
 */
contract DelayedOps {

    uint256 opsNonce = 0;

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
    function validateOperation(address sender, uint256 delay, bytes memory operation) internal;

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
        validateOperation(msg.sender, delayTime, operation);
        require(delayTime > 0, "validateOperation: should provide positive delayTime");
        bytes32 hash = keccak256(abi.encodePacked(operation, opsNonce));
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        emit DelayedOperation(msg.sender, opsNonce, operation, dueTime);
        opsNonce = opsNonce + 1;
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

    event debug(uint due, uint timeNow);

    mapping(bytes32 => uint) pending;

    /**
     * send a batch of delayed operations.
     * Note that we have our custom pack method, since there is no array-of-bytes in solidity..
     * each delayedOp is packed as a fixed-size 5-uint array
     * the caller is responsible to pass first 2 params both to the dispatcher method
     *  and the actual method, and use the same values.
     * the address, of all ops is validated to be the same.
     * the delay of such batched operation should be fixed (independent of individual ops)
     * usage:
     *  myContract.send_batched_delayedOps(myAddr, myRank,
     *      pack_multiple(
     *          myContract.removeParticipant(myAddr,myRank,oldp).encodeAbi()
     *          myContract.addParticipant(myAddr,myRank,newp).encodeAbi()
     *      )
     *  )
     
    function sendBatchedDelayedOps(address sender, uint rank, bytes operation) public {
        for( uint i=0; i<operation.length; i+= BLOCK_SIZE ) {
            validate_delayed_op
        }
        validate_params(sender, rank, operation);
        delayTime = validate_send(sender, rank);
        bytes32 hash = keccak256(sender, rank, operation);
        uint dueTime = now + delayTime;
        pending[hash] = dueTime;
        emit DelayedOperation(sender, operation, dueTime);
    }*/

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

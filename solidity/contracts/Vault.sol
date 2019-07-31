pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract Vault {

//    enum Asset { ETH, ERC20 }
//    struct PendingTransaction {
//        uint256 nonce;
//        address destination;
//        uint256 value;
//        Asset asset;
//        bytes8 token;
//        uint256 delay;
//    }
//    mapping (bytes32 => PendingTransaction) public pending;
    uint256 nonce;
    mapping (bytes32 => uint256) public pending;

    //****** events from erc20
    event Transfer(address indexed from, address indexed to, uint256 value);

    //******


    event FundsReceived(address sender, uint256 value);

    // hash is no longer exposed beyond the 'DelayedOps', so instead use 'nonce' for unique ID
    event TransactionPending(address destination, uint value, address erc20token, uint delay, uint256 nonce);
    event TransactionCompleted(address destination, uint value, address erc20token, uint256 nonce, address who);
    event TransactionCancelled(address destination, uint value, address erc20token, uint256 nonce, address who);

    address public gatekeeper;

    modifier gatekeeperOnly() {
        require(msg.sender == gatekeeper, "Only Gatekeeper can access vault functions");
        _;
    }

    modifier thisOnly() {
        require(address(this) == msg.sender, "Function can only be called by Vault");
        _;
    }

    constructor(address gk) public {
        gatekeeper = gk;
    }

    // ***** End TDD temp methods

    function() payable external {
        emit FundsReceived(msg.sender, msg.value);
    }


    function validateOperation(bytes memory blob, bytes memory singleOp) internal {}

    // ********** Immediate operations below this point

    function scheduleDelayedTransfer(uint256 delay, address destination, uint256 value, address token) public gatekeeperOnly {
//        bytes memory delayedTx = abi.encodeWithSelector(selector, msg.sender, nonce, delay, destination, value, token);
//        require(delay > 0, "delay should be positive.");
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, nonce, delay, destination, value, token));
        require(pending[hash] == 0, "Transfer already scheduled");
        uint256 dueTime = SafeMath.add(now, delay);
        pending[hash] = dueTime;
        emit TransactionPending(destination, value, token, delay, nonce);
        nonce++;

    }

    // Note: nonce should be passed
//    function scheduleDelayedEtherTransfer(uint256 delay, address destination, uint256 value) public gatekeeperOnly {
//        bytes memory delayedTransaction = abi.encode(msg.sender, nonce, delay, destination, value);
////        require(delay > 0, "delay should be positive.");
//        bytes32 hash = keccak256(abi.encodePacked(delayedTransaction));
//        require(pending[hash] == 0, "repeated delayed op");
//        uint dueTime = SafeMath.add(now, delay);
//        pending[hash] = dueTime;
//        emit TransactionPending(destination, value, address(0), delay, nonce);
//        nonce++;
//    }
//
//    function scheduleDelayedERC20Transfer(uint256 delay, address destination, uint256 value, address token) public gatekeeperOnly {
//        bytes memory delayedTransaction = abi.encode(msg.sender, nonce, destination, value, token);
////        require(delay > 0, "delay should be positive.");
//        bytes32 hash = keccak256(abi.encodePacked(delayedTransaction));
//        require(pending[hash] == 0, "repeated delayed op");
//        uint dueTime = SafeMath.add(now, delay);
//        pending[hash] = dueTime;
//        emit TransactionPending(destination, value, token, delay, nonce);
//        nonce++;
//    }

    function cancelTransfer(uint256 delay, address destination, uint256 value, address token, uint256 scheduledNonce, address who) public gatekeeperOnly {
//        bytes memory delayedTx = abi.encodeWithSelector(selector, msg.sender, nonce, delay, destination, value, token);
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, scheduledNonce, delay, destination, value, token));
        require(pending[hash] > 0, "cannot cancel, operation does not exist");
        delete pending[hash];
        emit TransactionCancelled(destination, value, token, scheduledNonce, who);
    }

    function applyDelayedTransfer(uint256 delay, address payable destination, uint256 value, address token, uint256 scheduledNonce, address who) public gatekeeperOnly {
        // "nonce, nonce" is not an error. It will be used by both the DelayedOps to ensure uniqueness of a transaction,
        // as well as it will be passed as an 'extraData' field to be emitted by the Vault itself.
        // TODO: probably less hacky to add it as a parameter. May need it for smth else later.
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, scheduledNonce, delay, destination, value, token));
        uint dueTime = pending[hash];
        require(dueTime != 0, "applyDelayedTransfer called for non existing transfer");
        require(now >= dueTime, "applyDelayedTransfer called before due time");

        if (token == address(0)) {
            transferETH(destination,value, scheduledNonce, who);
        }else {
            transferERC20(destination, value, scheduledNonce, who, ERC20(token));
        }
    }

    // ********** Delayed operations below this point

    // Nothing to do with a sender here - it's always Gatekeeper
    /*
    * @param opsNonce - uint256 field is enforced by the 'delayed' protocol. We store the delayed op's nonce to identify events.
    */
    function transferETH(address payable destination, uint256 value, uint256 scheduledNonce, address who)
    private {
        require(value <= address(this).balance, "Cannot transfer more then vault's balance");
        destination.transfer(value);
        emit TransactionCompleted(destination, value, address(0), scheduledNonce, who);
    }

    function transferERC20(address payable destination, uint256 value, uint256 scheduledNonce, address who, ERC20 token)
    private {
        require(value <= token.balanceOf(address(this)), "Cannot transfer more then vault's balance");
        token.transfer(destination, value);
        emit TransactionCompleted(destination, value, address(token), scheduledNonce, who);
    }

}
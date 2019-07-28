pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract Vault is DelayedOps {

    //****** events from erc20
    event Transfer(address indexed from, address indexed to, uint256 value);

    //******


    event FundsReceived(address sender, uint256 value);

    // hash is no longer exposed beyond the 'DelayedOps', so instead use 'nonce' for unique ID
    event TransactionPending(address destination, uint value, address erc20token, uint delay, uint256 nonce);
    event TransactionCompleted(address destination, uint value, address erc20token, uint256 nonce);

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

    // Note: nonce should be passed
    function scheduleDelayedEtherTransfer(uint256 delay, address destination, uint256 value) public gatekeeperOnly {
        // Alexf: There is no tragedy in using 'encodeWithSelector' here, I believe. Vault's API should not change much.
        bytes memory delayedTransaction = abi.encodeWithSelector(this.transferETH.selector, msg.sender, opsNonce, destination, value);
        scheduleDelayedBatch(abi.encode(msg.sender, bytes32(opsNonce)), delay, encodeDelayed(delayedTransaction));
        emit TransactionPending(destination, value, address(0), delay, opsNonce);
    }

    function scheduleDelayedERC20Transfer(uint256 delay, address destination, uint256 value, address token) public gatekeeperOnly {
        bytes memory delayedTransaction = abi.encodeWithSelector(this.transferERC20.selector, msg.sender, opsNonce, destination, value, token);
        scheduleDelayedBatch(abi.encode(msg.sender, bytes32(opsNonce)), delay, encodeDelayed(delayedTransaction));
        emit TransactionPending(destination, value, token, delay, opsNonce);
    }

    function cancelTransfer(bytes32 hash) public gatekeeperOnly {
        cancelDelayedOp(hash);
    }

    function applyDelayedTransfer(bytes memory operation, uint256 nonce) public gatekeeperOnly {
        // "nonce, nonce" is not an error. It will be used by both the DelayedOps to ensure uniqueness of a transaction,
        // as well as it will be passed as an 'extraData' field to be emitted by the Vault itself.
        // TODO: probably less hacky to add it as a parameter. May need it for smth else later.
        applyDelayedOps(abi.encode(msg.sender, bytes32(nonce)), nonce, operation);
    }


    // ********** Delayed operations below this point

    // Nothing to do with a sender here - it's always Gatekeeper
    /*
    * @param opsNonce - uint256 field is enforced by the 'delayed' protocol. We store the delayed op's nonce to identify events.
    */
    function transferETH(address /*sender*/, uint256 opsNonce, address payable destination, uint256 value)
    thisOnly
    external {
        require(value < address(this).balance, "Cannot transfer more then vault's balance");
        destination.transfer(value);
        emit TransactionCompleted(destination, value, address(0), opsNonce);
    }

    function transferERC20(address /*sender*/, uint256 opsNonce, address payable destination, uint256 value, ERC20 token) thisOnly
    external {
        token.transfer(destination, value);
        emit TransactionCompleted(destination, value, address(token), opsNonce);
    }

}
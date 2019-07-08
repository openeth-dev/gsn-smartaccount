pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract Vault is DelayedOps {

    //****** events from erc20
    event Transfer(address indexed from, address indexed to, uint256 value);

    //******


    event FundsReceived(address sender, uint256 value);

    // hash is no longer exposed beyond the 'DelayedOps', so instead use 'nonce' for unique ID
    event TransactionPending(address destination, uint value, ERC20 erc20token, uint delay, uint256 nonce);
    event TransactionCompleted(address destination, uint value, ERC20 erc20token, uint256 nonce);

    // ***** Start TDD temp methods

    address gatekeeper;

    function setGatekeeper(address gatekeeperAddress) public
    {
        gatekeeper = gatekeeperAddress;
    }

    // ***** End TDD temp methods

    function() payable external {
        emit FundsReceived(msg.sender, msg.value);
    }


    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {}


    // ********** Immediate operations below this point

    // TODO: test to check 'gatekeeperOnly' logic here!
    // Note: nonce should be passed
    function scheduleDelayedEtherTransfer(uint256 delay, address destination, uint256 value) public {
        // Alexf: There is no tragedy in using 'encodeWithSelector' here, I believe. Vault's API should not change much.
        uint256 nonce = getNonce();
        bytes memory delayedTransaction = abi.encodeWithSelector(this.transferETH.selector, msg.sender, nonce, destination, value);
        scheduleDelayedBatch(msg.sender, nonce, delay, encodeDelayed(delayedTransaction));
        emit TransactionPending(destination, value, ERC20(address(0)), delay, nonce);
    }

    function scheduleDelayedTokenTransfer(uint256 delay, address destination, uint256 value, ERC20 token) public {
        uint256 nonce = getNonce();
        bytes memory delayedTransaction = abi.encodeWithSelector(this.transferERC20.selector, msg.sender, nonce, destination, value, address(token));
        scheduleDelayedBatch(msg.sender, nonce, delay, encodeDelayed(delayedTransaction));
        emit TransactionPending(destination, value, token, delay, nonce);
    }

    function cancelTransfer(bytes32 hash) public {
        cancelDelayedOp(hash);
    }

    // TODO: sender of all operations in vault is a gatekeeper!!!
    function applyDelayedTransfer(bytes memory operation, uint256 nonce) public {
        // "nonce, nonce" is not an error. It will be used by both the DelayedOps to ensure uniqueness of a transaction,
        // as well as it will be passed as an 'extraData' field to be emitted by the Vault itself.
        // TODO: probably less hacky to add it as a parameter. May need it for smth else later.
        applyDelayedOps(msg.sender, nonce, nonce, operation);
    }


    // ********** Delayed operations below this point

    // Nothing to do with a sender here - it's always Gatekeeper
    /*
    * @param opsNonce - uint256 field is enforced by the 'delayed' protocol. We store the delayed op's nonce to identify events.
    */
    // TODO: test to check only 'this' can call here
    function transferETH(address /*sender*/, uint256 opsNonce, address payable destination, uint256 value) public {
        require(value < address(this).balance, "Cannot transfer more then vault's balance");
        destination.transfer(value);
        emit TransactionCompleted(destination, value, ERC20(address(0)), opsNonce);
    }

    function transferERC20(address /*sender*/, uint256 opsNonce, address payable destination, uint256 value, ERC20 token) public {
        token.transfer(destination, value);
        emit TransactionCompleted(destination, value, token, opsNonce);
    }

}
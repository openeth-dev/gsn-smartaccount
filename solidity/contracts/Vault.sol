pragma solidity ^0.5.5;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./Utilities.sol";

contract Vault {

    // Nice idea to use mock token address for ETH instead of 'address(0)'
    address constant internal ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint256 public nonce;
    mapping (bytes32 => uint256) public pending;

    //****** events from erc20
    event Transfer(address indexed from, address indexed to, uint256 value);

    //******


    event FundsReceived(address sender, uint256 value);

    event TransactionPending(address destination, uint value, address erc20token, uint delay, uint256 nonce);
    event TransactionCompleted(address destination, uint value, address erc20token, uint256 nonce, address sender);
    event TransactionCancelled(address destination, uint value, address erc20token, uint256 nonce, address sender);

    address public gatekeeper;

    modifier gatekeeperOnly() {
        require(msg.sender == gatekeeper, "Only Gatekeeper can access vault functions");
        _;
    }

    constructor(address gk) public {
        gatekeeper = gk;
    }

    // ***** End TDD temp methods

    function() payable external {
        emit FundsReceived(msg.sender, msg.value);
    }

    // ********** Immediate operations below this point

    function scheduleDelayedTransfer(uint256 delay, address destination, uint256 value, address token) public gatekeeperOnly {
        bytes32 hash = Utilities.vaultTransferHash(msg.sender, nonce, delay, destination, value, token);
        require(pending[hash] == 0, "Transfer already scheduled");
        uint256 dueTime = SafeMath.add(now, delay);
        pending[hash] = dueTime;
        emit TransactionPending(destination, value, token, delay, nonce);
        nonce++;
    }

    function cancelTransfer(uint256 delay, address destination, uint256 value, address token, uint256 scheduledNonce, address who) public gatekeeperOnly {
        bytes32 hash = Utilities.vaultTransferHash(msg.sender, scheduledNonce, delay, destination, value, token);
        require(pending[hash] > 0, "cannot cancel, operation does not exist");
        delete pending[hash];
        emit TransactionCancelled(destination, value, token, scheduledNonce, who);
    }

    function applyDelayedTransfer(uint256 delay, address payable destination, uint256 value, address token, uint256 scheduledNonce, address who) public gatekeeperOnly {
        bytes32 hash = Utilities.vaultTransferHash(msg.sender, scheduledNonce, delay, destination, value, token);
        uint dueTime = pending[hash];
        require(dueTime != 0, "applyDelayedTransfer called for non existing transfer");
        require(now >= dueTime, "applyDelayedTransfer called before due time");

        if (token == ETH_TOKEN_ADDRESS) {
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
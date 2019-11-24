pragma solidity 0.5.10;
// TODO: TEST ONLY REMOVE REPLACE WITH DEPLOYED CONTRACT

import 'tabookey-gasless/contracts/GsnUtils.sol';
import 'tabookey-gasless/contracts/RelayRecipient.sol';
import 'gsn-sponsor/contracts/GsnForwarder.sol';
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
/**
 * A Free sponsor. accepts to pay the gas for every call. FOR TESTING ONLY...
 */

/**
 * base-class for gas-sponsor.
 * Not used directly as a RelayRecipient. instead, its gsnForwarder is used.
 * Subclass should implement:
 *  - acceptRelayCall: do I accept to pay the gas for this call?
 *  - preRelayedCall, postRelayedCallL: perform gas calculation
 *  NOTE: we're not called directly from relayHub, so
 */
contract BaseRecipientSponsor is IRelayRecipient, Ownable {

    GsnForwarder gsnForwarder;

    //changing hub requires setting a new GsnForwarder, since it can't be
    // modified once created.
    function setRelayHub(IRelayHub hub) public onlyOwner {
        gsnForwarder = new GsnForwarder(hub, this);
    }

    /**
     * The relay-recipient that gets registered with the RelayHub.
     */
    function getGsnForwarder() view public returns (address) {
        return address(gsnForwarder);
    }

    function getHubAddr() view public returns (address) {
        return gsnForwarder.getHubAddr();
    }

    function getRelayHub() internal view returns (IRelayHub) {
        return IRelayHub(gsnForwarder.getHubAddr());
    }

    //deposit to the relay hub on behalf of our forwarder contract
    function relayHubDeposit() public payable {
        getRelayHub().depositFor.value(msg.value)(address(gsnForwarder));
    }


    //check current deposit on relay hub.
    //(wanted to name it "getRelayHubDeposit()", but we use the name from IRelayRecipient...
    function getRecipientBalance() view public returns (uint)  {
        return gsnForwarder.getRecipientBalance();
    }

    //withdraw deposit from relayHub
    function withdrawRelayHubDepositTo(uint amount, address payable target) onlyOwner public {
        gsnForwarder.withdrawRelayHubDepositTo(amount,target);
    }

    //must be used by preRelayedCall/postRelayedCall
    modifier gsnForwarderOnly {
        require( msg.sender == address(gsnForwarder) );
        _;
    }

}


contract FreeRecipientSponsor is BaseRecipientSponsor {

    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    )
    external
    view
    returns (uint256, bytes memory) {
        (relay, from, encodedFunction, transactionFee, gasPrice,gasLimit,nonce, approvalData, maxPossibleCharge);
        return (0,"");
    }


    //free ride...
    function preRelayedCall(bytes calldata context) external
//    gsnForwarderOnly
    returns (bytes32) {
        (context);
        return 0;
    }

    //free ride...
    function postRelayedCall(bytes calldata context, bool success, uint actualCharge, bytes32 preRetVal)
    external
//    gsnForwarderOnly
    {
        (context, success, actualCharge, preRetVal);
    }

}

library  verifyItCompilesWithNoMissingMethods {
    function asd() internal {
        new FreeRecipientSponsor();
    }
}
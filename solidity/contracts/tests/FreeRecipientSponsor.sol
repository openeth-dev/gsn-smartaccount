pragma solidity 0.5.10;
// TODO: TEST ONLY REMOVE REPLACE WITH DEPLOYED CONTRACT

import 'tabookey-gasless/contracts/GsnUtils.sol';
import 'tabookey-gasless/contracts/RelayRecipient.sol';
import 'gsn-sponsor/contracts/GsnForwarder.sol';
import 'gsn-sponsor/contracts/BaseRecipientSponsor.sol';
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import './MockGsnForwarder.sol';
/**
 * A Free sponsor. accepts to pay the gas for every call. FOR TESTING ONLY...
 */
contract FreeRecipientSponsor is BaseRecipientSponsor {

    function setForwarder(address forwarder) public {
        gsnForwarder = GsnForwarder(forwarder);
    }

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
    function preRelayedCall(bytes calldata context) external gsnForwarderOnly returns (bytes32) {
        (context);
        return 0;
    }

    //free ride...
    function postRelayedCall(bytes calldata context, bool success, uint actualCharge, bytes32 preRetVal)
    external gsnForwarderOnly {
        (context, success, actualCharge, preRetVal);
    }

}

library  verifyItCompilesWithNoMissingMethods {
    function asd() internal {
        new FreeRecipientSponsor();
    }
}
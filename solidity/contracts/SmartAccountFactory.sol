pragma solidity ^0.5.10;

import "./SmartAccount.sol";
import "tabookey-gasless/contracts/GsnUtils.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract SmartAccountFactory is GsnRecipient, Ownable {
    using GsnUtils for bytes;
    using ECDSA for bytes32;

    uint256 constant APPROVAL_VALIDITY = 1 days;

    event SmartAccountCreated(address sender, SmartAccount smartAccount, bytes32 salt);

    mapping(address => bool) public trustedSigners;
    mapping(bytes32 => address) public knownSmartAccounts;

    constructor(address _forwarder) public {
        setGsnForwarder(_forwarder);
    }

    function addTrustedSigners(address[] memory signers) public onlyOwner {
        for (uint256 i = 0; i < signers.length; i++) {
            trustedSigners[signers[i]] = true;
        }
    }

    function isApprovedSigner(bytes32 hash, bytes memory sig) public view returns (bool) {
        return trustedSigners[hash.recover(sig)];
    }

    function acceptRelayedCall(
        address relay, address from, bytes calldata encodedFunction,
        uint256 transactionFee, uint256 gasPrice, uint256 gasLimit,
        uint256 nonce, bytes calldata approvalData, uint256 maxPossibleCharge
    ) external view returns (uint256 res, bytes memory data) {
        (relay, from, encodedFunction, transactionFee, gasPrice,gasLimit,
        nonce, approvalData, maxPossibleCharge);

        bytes4 methodSig = encodedFunction.getMethodSig();
        require(methodSig == this.newSmartAccount.selector, "Call must be only newSmartAccount()");
        bytes32 smartAccountId = bytes32(encodedFunction.getParam(0));
        require(knownSmartAccounts[smartAccountId] == address(0), "SmartAccount already created for this id");
        (bytes4 timestamp, bytes memory sig) = abi.decode(approvalData,(bytes4, bytes));
        require(uint32(timestamp) + APPROVAL_VALIDITY > now, "Outdated request");
        bytes32 hash = keccak256(abi.encodePacked(smartAccountId, timestamp)).toEthSignedMessageHash();
        require(isApprovedSigner(hash, sig), "Not signed by approved signer");

        return (0, "");
    }
    function _acceptCall( address from, bytes memory encodedFunction) view internal returns (uint256 res, bytes memory data){}

    /**
    * @param smartAccountId - generated through keccak256(<userEmail>) by backend service
    */
    function newSmartAccount(bytes32 smartAccountId) public {
        require(msg.sender == getHubAddr() || msg.sender == this.getGsnForwarder(), "Must be called through GSN");
        require(knownSmartAccounts[smartAccountId] == address(0), "SmartAccount already created for this id");
        SmartAccount smartAccount = new SmartAccount(this.getGsnForwarder(), getSender());
        knownSmartAccounts[smartAccountId] = address(smartAccount);
        emit SmartAccountCreated(getSender(), smartAccount, smartAccountId);
    }
}

pragma solidity ^0.5.10;

import "./ISmartAccount.sol";
import "tabookey-gasless/contracts/GsnUtils.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "./ProxyFactory.sol";
import "gsn-sponsor/contracts/GsnRecipient.sol";

contract SmartAccountFactory is GsnRecipient, Ownable, ProxyFactory {
    using GsnUtils for bytes;
    using ECDSA for bytes32;

    ISmartAccount template;

    uint256 constant APPROVAL_VALIDITY = 1 days;

    event SmartAccountCreated(address sender, ISmartAccount smartAccount, bytes32 smartAccountId);

    mapping(address => bool) public trustedSigners;
    mapping(bytes32 => address) public knownSmartAccounts;

    constructor(address _forwarder, address _template) public {
        setGsnForwarder(_forwarder);
        template = ISmartAccount(_template);
        //        createAccountTemplate();
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
        //        require(knownSmartAccounts[smartAccountId] == address(0), "SmartAccount already created for this id");
        //        (bytes4 timestamp, bytes memory sig) = abi.decode(approvalData,(bytes4, bytes));
        //        require(uint32(timestamp) + APPROVAL_VALIDITY > now, "Outdated request");
        //        bytes32 hash = keccak256(abi.encodePacked(smartAccountId, timestamp)).toEthSignedMessageHash();
        //        require(isApprovedSigner(hash, sig), "Not signed by approved signer");
        validateNewSmartAccountRequest(smartAccountId, approvalData);
        return (0, "");
    }

    function _acceptCall(address from, bytes memory encodedFunction) view internal returns (uint256 res, bytes memory data){}

    function validateNewSmartAccountRequest(bytes32 smartAccountId, bytes memory approvalData) private view returns (bool) {
        require(knownSmartAccounts[smartAccountId] == address(0), "SmartAccount already created for this id");
        (bytes4 timestamp, bytes memory sig) = abi.decode(approvalData, (bytes4, bytes));
        require(uint32(timestamp) + APPROVAL_VALIDITY > now, "Outdated request");
        bytes32 hash = keccak256(abi.encodePacked(smartAccountId, timestamp)).toEthSignedMessageHash();
        require(isApprovedSigner(hash, sig), "Not signed by approved signer");
        return true;
    }

    /**
    * @param smartAccountId - generated through keccak256(<userEmail>) by backend service
    */
    function newSmartAccount(bytes32 smartAccountId, bytes memory approvalData) public {
        require(address(template) != address(0), "newSmartAccount: createAccountTemplate not called");
        require(validateNewSmartAccountRequest(smartAccountId, approvalData),
            "Must have a valid approvalData");
        require(knownSmartAccounts[smartAccountId] == address(0), "SmartAccount already created for this id");
        address payable proxy = address(uint160(createProxyImpl(address(template), "")));
        ISmartAccount smartAccount = ISmartAccount(proxy);
        smartAccount.ctr2(getGsnForwarder(), getSender());
        knownSmartAccounts[smartAccountId] = address(smartAccount);
        emit SmartAccountCreated(getSender(), smartAccount, smartAccountId);
    }
}

pragma solidity ^0.5.10;

import "./Gatekeeper.sol";
import "tabookey-gasless/contracts/GsnUtils.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract VaultFactory is GsnRecipient, Ownable {
    using GsnUtils for bytes;
    using ECDSA for bytes32;

    event VaultCreated(address sender, Gatekeeper gatekeeper, bytes32 salt);

    mapping(address => bool) public trustedSigners;
    mapping(bytes32 => address) public knownVaults;

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
        require(methodSig == this.newVault.selector, "Call must be only newVault()");
        bytes32 vaultId = bytes32(encodedFunction.getParam(0));
        require(knownVaults[vaultId] == address(0), "Vault already created for this id");
        (bytes4 timestamp, bytes memory sig) = abi.decode(approvalData,(bytes4, bytes));
        require(now >= uint32(timestamp), "Outdated request");
        bytes32 hash = keccak256(abi.encodePacked(vaultId, timestamp)).toEthSignedMessageHash();
        require(isApprovedSigner(hash, sig), "Not signed by approved signer");

        return (0, "");
    }
    function _acceptCall( address from, bytes memory encodedFunction) view internal returns (uint256 res, bytes memory data){}

    function newVault(bytes32 vaultId) public {
        require(knownVaults[vaultId] == address(0), "Vault already created for this id");
        Gatekeeper gatekeeper = new Gatekeeper(this.getGsnForwarder(), getSender());
        knownVaults[vaultId] = address(gatekeeper);
        emit VaultCreated(getSender(), gatekeeper, vaultId);
    }
}

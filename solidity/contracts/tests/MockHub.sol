pragma solidity ^0.5.10;
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract MockHub {
    using ECDSA for bytes32;
    bool checkSig;

    event RelayAdded(address indexed relay, address indexed owner, uint256 transactionFee, uint256 stake, uint256 unstakeDelay, string url);

    constructor() public {
        checkSig=true;
        emit RelayAdded(address(0), address(0), 0, 0, 0, "http://mock.relay.event");
    }

    //enable/disable signature checking.
    function setCheckSig(bool on) public {
        checkSig = on;
    }

    function balanceOf(address) pure public returns (uint256) {
        return 0;
    }

    function version() pure public returns (string memory){
        return "1";
    }

    function getNonce(address) pure public returns (uint256) {
        return 0;
    }

    function canRelay(
        address,
        address,
        address,
        bytes memory,
        uint256,
        uint256,
        uint256,
        uint256,
        bytes memory,
        bytes memory
    )
    public view returns (uint256 status, bytes memory recipientContext)
    {
        (this);
        return (0, "");
    }

    event TransactionRelayed(bool success, string message);

    function relayCall(
        address from,
        address recipient,
        bytes memory encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes memory signature,
        bytes memory approvalData
    )
    public
    {
        (approvalData);
        bytes memory packed = abi.encodePacked("rlx:", from, recipient, encodedFunction, transactionFee, gasPrice, gasLimit, nonce, address(this));
        bytes32 hashedMessage = keccak256(abi.encodePacked(packed, msg.sender));

        if (checkSig && hashedMessage.toEthSignedMessageHash().recover(signature) != from) {
            revert( "wrong signature");
        }

        bytes memory encodedFunctionWithFrom = abi.encodePacked(encodedFunction, from);
        (bool relayedCallSuccess, bytes memory message) = recipient.call.gas(gasLimit)(encodedFunctionWithFrom);
        emit TransactionRelayed(relayedCallSuccess, string(message));
    }

    function depositFor(address _address) public payable{
    }
}
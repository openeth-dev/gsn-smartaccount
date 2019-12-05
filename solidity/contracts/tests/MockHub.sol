pragma solidity ^0.5.10;

contract MockHub {
    event RelayAdded(address indexed relay, address indexed owner, uint256 transactionFee, uint256 stake, uint256 unstakeDelay, string url);

    constructor() public {
        emit RelayAdded(address(0), address(0), 0, 0, 0, "hello world");
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
        return (0, "");
    }

    event TransactionRelayed(bool success, string message);

    function relayCall(
        address from,
        address recipient,
        bytes memory encodedFunction,
        uint256,
        uint256,
        uint256 gasLimit,
        uint256,
        bytes memory,
        bytes memory
    )
    public
    {
        bytes memory encodedFunctionWithFrom = abi.encodePacked(encodedFunction, from);
        (bool relayedCallSuccess, bytes memory message) = recipient.call.gas(gasLimit)(encodedFunctionWithFrom);
        emit TransactionRelayed(relayedCallSuccess, string(message));
    }
}
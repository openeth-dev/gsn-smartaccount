pragma solidity >=0.4.0 <0.6.0;


contract Contract {

    event ContractEmitted(string message, uint value, address msgSender, address origin);
	
	function emitMessage(string memory message, uint value) public {
		emit ContractEmitted(message, value, msg.sender, tx.origin);
	}

	function getData() public pure returns (uint, uint){
		return (2, 3);
	}
}
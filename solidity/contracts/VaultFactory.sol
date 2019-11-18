pragma solidity ^0.5.10;

import "./Gatekeeper.sol";

contract VaultFactory {

    event VaultCreated(address sender, Gatekeeper gatekeeper);

    function newVault() public {
        Gatekeeper gatekeeper = new Gatekeeper();
        emit VaultCreated(msg.sender, gatekeeper);
    }
}

pragma solidity ^0.5.5;

import "./Gatekeeper.sol";
import "./Vault.sol";

contract VaultFactory {

    event VaultCreated(address sender, Gatekeeper gatekeeper, Vault vault);

    function newVault() public {
        Gatekeeper gatekeeper = new Gatekeeper();
        Vault vault = new Vault(address(gatekeeper));
        emit VaultCreated(msg.sender, gatekeeper, vault);
    }
}

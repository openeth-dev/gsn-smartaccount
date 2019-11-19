pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "tabookey-gasless/contracts/GsnUtils.sol";

import "./BypassPolicy.sol";


contract WhitelistBypassPolicy is BypassPolicy {

    using LibBytes for bytes;

    event WhitelistChanged(address indexed destination, bool isWhitelisted);

    mapping(address => bool) whitelist;
    address gatekeeper;

    constructor(address _gatekeeper) public {
        gatekeeper = _gatekeeper;
    }

    function addWhitelistedTarget(
        address destination,
        bool isWhitelisted)
    external {
        require(msg.sender == gatekeeper, "only gatekeeper can change the whitelist");
        whitelist[destination] = isWhitelisted;
        emit WhitelistChanged(destination, isWhitelisted);
    }

    function getBypassPolicy(
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public view returns (uint256 /* delay */, uint256 /* requiredConfirmations */) {
        if (value > 0) {
            return getPolicyForRecipient(target);
        }
        require(encodedFunction.length > 24, "transaction data is too short");
        bytes4 selector = encodedFunction.readBytes4(0);
        if (selector == IERC20(target).transfer.selector ||
        selector == IERC20(target).approve.selector)
        {
            address tokenRecipient = address(uint160(GsnUtils.getParam(encodedFunction, 0)));
            return getPolicyForRecipient(tokenRecipient);
        }
        revert("method signature is not recognised");
    }

    function getPolicyForRecipient(address recipient) internal view returns (uint256, uint256) {
        if (whitelist[recipient])
            return (WHITELIST, WHITELIST);
        else
            return (USE_DEFAULT, USE_DEFAULT);
    }
}
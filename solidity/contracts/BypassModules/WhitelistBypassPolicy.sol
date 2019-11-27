pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "tabookey-gasless/contracts/GsnUtils.sol";

import "./BypassPolicy.sol";


contract WhitelistBypassPolicy is BypassPolicy {

    using LibBytes for bytes;

    uint256 constant WHITELIST = 0;
    uint256 constant USE_DEFAULT = uint(-1);

    event WhitelistChanged(address indexed destination, bool isWhitelisted);

    mapping(address => bool) whitelist;
    address gatekeeper;

    constructor(address _gatekeeper, address[] memory _whitelist) public {
        gatekeeper = _gatekeeper;
        for (uint i = 0; i < _whitelist.length; i++) {
            whitelist[_whitelist[i]] = true;
        }
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
    public view returns (uint256 /* delay */, uint256 /* requiredConfirmations */, bool) {
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

    function getPolicyForRecipient(address recipient) internal view returns (uint256, uint256, bool) {
        if (whitelist[recipient])
            return (WHITELIST, WHITELIST, false);
        else
            return (USE_DEFAULT, USE_DEFAULT, true);
    }
}
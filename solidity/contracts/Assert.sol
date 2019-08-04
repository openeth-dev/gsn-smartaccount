pragma solidity ^0.5.5;

contract AssertTester {
    constructor() public {
        Assert.equal(msg.sender, address(this), "asdsd");
    }
}

library Assert {

    function equal(address actual, address expected, string memory text) internal pure {
        if (expected == actual) return;
        bytes memory t = abi.encodePacked(text, ": \n",
            "expected: ", toString(expected), "\n",
            "  actual: ", toString(actual), "\n"
        );
        revert( string(t));
    }

    function equal(uint actual, uint expected, string memory text) internal pure {
        if (expected == actual) return;
        bytes memory t = abi.encodePacked(text, ": \n",
            "expected: ", toString(expected), "\n",
            "  actual: ", toString(actual), "\n"
        );
        revert( string(t));
    }

    function equal(bytes32 actual, bytes32 expected, string memory text) internal pure {
        if (expected == actual) return;
        bytes memory t = abi.encodePacked(text, ": \n",
            "expected: ", toString(expected), "\n",
            "  actual: ", toString(actual), "\n"
        );
        revert( string(t));
    }

    function concat( string memory str, address a) internal pure returns (string memory) {
        bytes memory b =abi.encodePacked(str, toString(a));
        return string(b);
    }

    function concat( string memory str, uint a) internal pure returns (string memory) {
        bytes memory b =abi.encodePacked(str, toString(a));
        return string(b);
    }

    function toString(address _addr) pure internal returns (string memory) {
        bytes32 value = bytes32(uint256(_addr));
        return toString(value, 20);
    }

    function toString(bytes32 b) pure internal returns (string memory) {
        return toString(b, 32);
    }

    function toString(bytes32 value, uint nbytes) pure internal returns(string memory) {
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(nbytes*2+2);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < nbytes; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
        }
        return string(str);
    }

    function toString(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}
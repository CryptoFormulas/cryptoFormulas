pragma solidity ^0.6.0;

/**
    Contract containing definitions for
*/
contract FormulaDefiner {

    struct Operation {
        uint16 instruction;
        bytes operands; // encoded operands
    }

    struct Formula {
        uint256 salt;
        uint256 signedEndpointCount;
        address[] endpoints;
        Operation[] operations;
        bytes[] signatures;
    }
}

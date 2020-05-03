import '../../src/contracts/CryptoFormulas.sol';


/**
    Contract exposing som of Crypto Formulas contract's private functions and adds additional debugging options.
*/
contract FormulasDebugger is CryptoFormulas {

    /////////////////// Exposure of private methods ////////////////////////////

    function public_validateSerializedFormula(bytes memory compiledFormula) public view returns (bool) {
        Formula memory formulaInfo = decompileFormulaCompiled(compiledFormula);
        bytes32 hash = calcFormulaHash(formulaInfo);

        return validateFormula(formulaInfo, hash);
    }

    function public_decompileEndpoints(bytes memory compiledFormula, uint256 offset) public pure returns (address[] memory, uint16 signedEndpointCount, uint256 newOffset) {
        return super.decompileEndpoints(compiledFormula, offset);
    }

    function public_decompileOperations(bytes memory compiledFormula, uint256 offset) public pure returns (Operation[] memory, uint256 newOffset) {
        return super.decompileOperations(compiledFormula, offset);
    }
/*
    function public_decompileSignatures(bytes memory compiledFormula, uint256 offset) public pure returns (bytes[] memory, uint256 newOffset) {
        return super.decompileSignatures(compiledFormula, offset);
    }
*/

    /////////////////// Debugging //////////////////////////////////////////////

    function debugBytes(bytes memory compiledFormula, uint256 offset) public pure returns (bytes32 result) {
        assembly {
            result := mload(add(compiledFormula, offset))
        }
    }

    function debugBytes16(bytes memory compiledFormula, uint256 offset) public pure returns (uint16 result) {
        assembly {
            result := mload(add(compiledFormula, offset))
        }
    }

    function debugCalcFormulaHash(Formula memory formulaInfo) public pure returns (bytes memory) {
        bytes memory packedOperations;
        for (uint256 i = 0; i < formulaInfo.operations.length; i++) {
            packedOperations = abi.encodePacked(packedOperations, formulaInfo.operations[i].instruction, formulaInfo.operations[i].operands);
        }

        bytes memory messageToSign = abi.encodePacked(
            formulaInfo.salt,
            uint16(formulaInfo.endpoints.length),
            uint16(formulaInfo.signedEndpointCount),
            packedOperations
        );

        return messageToSign;
    }
}

/**
    Recieves Ether at deploy and let anybody sent amount of ether to given address.
*/
contract EtherFeeder {

    constructor() public payable {

    }

    function sendEther(uint256 amount, CryptoFormulas to) public {
        to.topUpEther{value: amount}();
    }
}

/**
    Contract that force sent of Ether to any address.
    Uses selfdestruct in constructor -> it will never be actually deployed.
*/
contract EtherMartyr {

    constructor(address payable to) public payable {
        require(msg.value > 0);
        selfdestruct(to);
    }
}

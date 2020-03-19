import './FormulaDefiner.sol';
import './Constants.sol';
//import 'solidity-bytes-utils/contracts/BytesLib.sol'; // can't be used now because this library doesn't support solidity 0.6.x
import './libraries/BytesLib.sol';


/**
    Contract for deserialization of serialized Formula.
*/
contract FormulaDecompiler is FormulaDefiner, Constants {

    /**
        Unserializes serialized Formula.
    */
    function decompileFormulaCompiled(bytes memory compiledFormula) public pure returns (Formula memory) {
        Formula memory formulaInfo;
        uint256 offset = sizeWord; // compiledFormula bytes size

        uint256 salt;
        assembly {
            salt := mload(add(compiledFormula, offset))
        }
        formulaInfo.salt = salt;
        offset += sizeSalt;

        (formulaInfo.endpoints, formulaInfo.signedEndpointCount, offset) = decompileEndpoints(compiledFormula, offset);
        (formulaInfo.operations, offset) = decompileOperations(compiledFormula, offset);
        (formulaInfo.signatures, offset) = decompileSignatures(compiledFormula, offset, formulaInfo.signedEndpointCount);

        return formulaInfo;
    }

    /**
        Unserializes Formula's endpoints.
    */
    function decompileEndpoints(bytes memory compiledFormula, uint256 offset) internal pure returns (address[] memory, uint16 signedEndpointCount, uint256 newOffset) {
        uint256 shiftArrayLength = sizeWord - sizeArrayLength;
        uint256 shiftAddress = sizeWord - sizeAddress;

        uint16 endpointCount;
        uint16 tmpSignedEndpointCount;
        assembly {
            endpointCount := mload(add(compiledFormula, sub(offset, shiftArrayLength)))
        }
        offset += sizeArrayLength;
        assembly {
            tmpSignedEndpointCount := mload(add(compiledFormula, sub(offset, shiftArrayLength)))
        }
        offset += sizeArrayLength;

        require(tmpSignedEndpointCount <= endpointCount, 'Invalid signed endpoint count');

        address endpoint;
        address[] memory endpoints = new address[](endpointCount);

        for (uint256 i = 0; i < endpointCount; i++) {
            assembly {
                endpoint := mload(add(compiledFormula, sub(offset, shiftAddress)))
            }
            offset += sizeAddress;
            endpoints[i] = endpoint;
        }

        return (endpoints, tmpSignedEndpointCount, offset);
    }

    /**
        Unserializes Formula's operations.
    */
    function decompileOperations(bytes memory compiledFormula, uint256 offset) internal pure returns (Operation[] memory, uint256 newOffset) {
        uint256 shiftArrayLength = sizeWord - sizeArrayLength;

        uint16 operationCount;
        assembly {
            operationCount := mload(add(compiledFormula, sub(offset, shiftArrayLength)))
        }
        offset += sizeArrayLength;


        uint16 instruction;
        bytes memory operands;
        uint256 operandsLength;
        Operation[] memory operations = new Operation[](operationCount);

        uint256 shiftInstruction = sizeWord - sizeInstruction;
        for (uint256 i = 0; i < operationCount; i++) {
            assembly {
                instruction := mload(add(compiledFormula, sub(offset, shiftInstruction)))
            }
            offset += sizeInstruction;

            operandsLength = decompileOperandsLength(instruction, compiledFormula, offset);
            // sizeWord substraction is needed here because BytesLib.slice doesn't account for first uint256 representing bytes length
            operands = BytesLib.slice(compiledFormula, offset - sizeWord, operandsLength);
            offset += operandsLength;

            operations[i] = Operation({
                instruction: instruction,
                operands: operands
            });
        }

        return (operations, offset);
    }

    /**
        Unserializes Formula's signatures.
    */
    function decompileSignatures(bytes memory compiledFormula, uint256 offset, uint256 signatureCount) internal pure returns (bytes[] memory, uint256 newOffset) {
        bytes[] memory signatures = new bytes[](signatureCount);

        for (uint256 i = 0; i < signatureCount; i++) {
            // sizeWord substraction is needed here because BytesLib.slice doesn't account for first uint256 representing bytes length
            signatures[i] = BytesLib.slice(compiledFormula, offset - sizeWord, sizeSignature);
            offset += sizeSignature;
        }

        return (signatures, offset);
    }

    /**
        Returns expected length of instruction's operands.
    */
    function decompileOperandsLength(uint256 instruction, bytes memory compiledFormula, uint256 offset) internal pure returns (uint256) {
        // so far only static length instructions exist but in the future lenght might be dynamicly loaded
        // from compiledFormula thus that parameter exists

        if (instruction == 0 || instruction == 3) {
            return 0
                + sizePointer // endpoint index
                + sizePointer // to address
                + sizeAmount // amount
            ;
        }

        if (instruction == 1 || instruction == 2) {
            return 0
                + sizePointer // endpoint index
                + sizePointer // to address
                + sizeAmount // amount or tokenId
                + sizeAddress // token address
            ;
        }

        if (instruction == 4) {
            return 0
                + sizePointer // endpoint index
                + sizeAmount // amount
            ;
        }

        if (instruction == 5) {
            return 0
                + sizeBlockNumber // minimum block number
                + sizeBlockNumber // maximum block number
            ;
        }

        revert('Unknown instruction');
    }
}

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './FormulaDecompiler.sol';
import './FormulaPresigner.sol';
import './libraries/SignatureVerifier.sol';


/**
    Contract validator Formula.
*/
contract FormulaValidator is FormulaDecompiler, FormulaPresigner {


    /**
        Validate Formula.
    */
    function validateFormula(Formula memory formulaInfo) public view returns (bool) {
        bytes32 hash = calcFormulaHash(formulaInfo);

        return validateFormula(formulaInfo, hash);
    }

    /**
        Validate Formula.
    */
    function validateFormula(Formula memory formulaInfo, bytes32 hash) internal view returns (bool) {
        if (formulaInfo.signedEndpointCount != formulaInfo.signatures.length) {
            return false;
        }

        if (!validateSignatures(formulaInfo, hash)) {
            return false;
        }

        if (!validateFee(formulaInfo)) {
            return false;
        }

        return true;
    }

    /**
        Validate Formula's signatures.
    */
    function validateSignatures(Formula memory formulaInfo, bytes32 hash) internal view returns (bool) {
        for (uint256 i = 0; i < formulaInfo.signedEndpointCount; i++) {
            bool isEmpty = isSignatureEmpty(formulaInfo.signatures[i]);
            if (isEmpty && presignedFormulas[formulaInfo.endpoints[i]][hash] == PresignStates.permitted) {
                continue;
            }

            if (isEmpty && formulaInfo.endpoints[i] == msg.sender) {
                continue;
            }

            if (isEmpty) {
                return false;
            }

            if (!SignatureVerifier.verifySignaturePrefixed(formulaInfo.endpoints[i], hash, formulaInfo.signatures[i])) {
                return false;
            }
        }

        return true;
    }

    /**
        Checks if signature is empty (all zeros).
    */
    function isSignatureEmpty(bytes memory signature) internal pure returns (bool) {
        uint256 shiftFirstPart = sizeWord + (sizeSignature - sizeWord);
        uint256 shiftSecondPart = sizeWord + (sizeSignature - sizeWord);
        uint256 tmp;
        assembly {
            tmp := mload(add(signature, shiftFirstPart))
        }

        if (tmp == 0) {
            return true;
        }

        assembly {
            tmp := mload(add(signature, shiftSecondPart))
        }

        if (tmp == 0) {
            return true;
        }

        return false;
    }

    /**
        Checks if signature is empty (all zeros).
    */
    function validateFee(Formula memory formulaInfo) virtual internal pure returns (bool) {
        for (uint256 i = 0; i < formulaInfo.operations.length; i++) {
            if (formulaInfo.operations[i].instruction == feeInstruction) {
                return true;
            }
        }

        return false;
    }

    function calcFormulaHash(Formula memory formulaInfo) public pure returns (bytes32) {
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
        bytes32 hash = keccak256(messageToSign);

        return hash;
    }
}

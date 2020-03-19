pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;


/**
    Contract managing Formula presigns.
    Presign can be positive (party permits Formula execution) or negative (party forbids Formula execution
    ignoring possibly existing signature).
*/
contract FormulaPresigner {

    enum PresignStates {
        defaultValue,
        permitted,
        forbidden
    }

    event FormulaPresigner_presignFormula(address party, bytes32 formulaHash, PresignStates newState);

    mapping(address => mapping(bytes32 => PresignStates)) public presignedFormulas;

    /**
        Set presign for the given formula.
    */
    function presignFormula(bytes32 formulaHash, PresignStates state) external {
        presignedFormulas[msg.sender][formulaHash] = state;

        emit FormulaPresigner_presignFormula(msg.sender, formulaHash, state);
    }
}

import '../../src/contracts/CryptoFormulas.sol';
import '../../src/contracts/FormulaValidator.sol';

/**
    Crypto Formulas contract without enforcing fees. Used for debugging.
*/
contract FormulasFeeless is CryptoFormulas {

    /////////////////// Exposure of private methods ////////////////////////////

    function validateFee(Formula memory formulaInfo) override internal pure returns (bool) {
        return true;
    }
}

/**
    Crypto Formulas contract's validator part without enforcing fees. Used for debugging.
*/
contract FormulaValidatorFeeless is FormulaValidator {

    /////////////////// Exposure of private methods ////////////////////////////

    function validateFee(Formula memory formulaInfo) override internal pure returns (bool) {
        return true;
    }
}

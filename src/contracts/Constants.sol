/**
    Constants definitions.
*/
contract Constants {

    // TODO: upgrade this when there will be macro or proper constant support in Solidity
    // TODO: consider using `solc --optimize` to improve performance in code using this constants
    // TODO: remove various `shiftXXX` variables scattered in code after Solidity's error is resolved
    //       "Constant variables not supported by inline assembly"
    //       https://github.com/ethereum/solidity/issues/3776
    uint256 constant sizeWord = 32; // Ethereum word size (uint256 size)
    uint256 constant sizeArrayLength = 2; // size of array length representation
    uint256 constant sizeAmount = sizeWord; // size of (ether/token/etc.) amount
    uint256 constant sizeAddress = 20; // size of ethereum address
    uint256 constant sizePointer = 2; // size of endpoint pointer
    uint256 constant sizeInstruction = 2; // size of instruction code
    uint256 constant sizeSalt = sizeWord; // size of unique salt
    uint256 constant sizeSignature = 65; // size of signature
    uint256 constant sizeBlockNumber = 4; // size of block number (used for time conditioning)

    uint256 constant formulaFee = 0.0004 ether; // fee per operation
    uint256 constant feeInstruction = 4;

    /**
        Returns fee per operation this contract is charging.
    */
    function feePerOperation() external pure returns (uint256) {
        return formulaFee;
    }
}

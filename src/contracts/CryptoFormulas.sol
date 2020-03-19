pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;


import './FormulaValidator.sol';
import './FormulaDecompiler.sol';
import './FormulaResolver.sol';
import './DonationWithdrawal.sol';
import './interfaces/Ownable.sol';

// TODO: consider adding ERC223 support for recieving ERC20/ERC223 funds
// TODO: consider support for recieving and sending tokens via transfer() -> this is needed for cases when 3rd party
// contract is allowed to send tokens, yet he is not allowed to set allowance for the Crypto Formulas contract

/**
    Crypto Formulas contract works as VM with instruction set focused on manipulating the most common
    Ethereum based assets (native Ether, ERC20 tokens and ERC721 tokens).
*/
contract CryptoFormulas is Ownable, FormulaDecompiler, FormulaValidator, FormulaResolver, DonationWithdrawal {

    event Formulas_FormulaExecuted(bytes32 indexed messageHash);

    mapping(bytes32 => bool) public executedFormulas;

    constructor() Ownable() public {

    }

    /**
        Execute formula. Execution is atomic.
    */
    function executeFormula(bytes calldata compiledFormula) external payable {
        Formula memory formulaInfo = decompileFormulaCompiled(compiledFormula);
        bytes32 hash = calcFormulaHash(formulaInfo);

        // allow execution of each formula only once
        require(!executedFormulas[hash], 'Formula already executed.');
        executedFormulas[hash] = true;

        require(validateFormula(formulaInfo, hash), 'Invalid formula.');

        if (msg.value > 0) {
            ether_recieve(msg.sender, msg.value);
        }

        resolveFormula(formulaInfo);

        emit Formulas_FormulaExecuted(hash);
    }

    /**
        Recieves senders ether and records new balance to inner ledger.
    */
    function topUpEther() external payable {
        require(msg.value > 0, 'Must top-up more than zero Wei');

        ether_recieve(msg.sender, msg.value);
    }

    /**
        Recieves senders ether and records new balance to inner ledger.

        WARNING: Fallback function is not supporting other contracts!
            If you send ether using `.transfer()` with only 23000 gas stipend it will fail.
    */
    receive() external payable {
        require(msg.value > 0, "Can't receive zero Wei");

        ether_recieve(msg.sender, msg.value);
    }

}

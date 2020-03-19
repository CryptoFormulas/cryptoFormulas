pragma solidity ^0.6.0;

import '../interfaces/IERC20.sol';


/**
    Adapter for manipulating ERC20 tokens.
*/
contract FormulasAdapter_ERC20 /* is FormulasAdapter */ {

    event FormulasAdapter_ERC20_Sent(address token, address indexed from, address indexed to, uint256 amount);

    /**
        Transfers selected amount of ERC20 tokens from one party to the other.
        Expects to be allowed (via `erc20.approve()`) to send funds owned by `from` party.
    */
    function erc20_transferValue(address token, address from, address to, uint256 amount) internal {
        require(IERC20(token).transferFrom(from, to, amount), 'IERC20 refused transerFrom() transaction.');

        emit FormulasAdapter_ERC20_Sent(token, from, to, amount);
    }
}


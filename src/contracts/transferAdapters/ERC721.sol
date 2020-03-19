pragma solidity ^0.6.0;

import '../interfaces/IERC721.sol';


/**
    Adapter for manipulating ERC721 tokens.
*/
contract FormulasAdapter_ERC721 /* is FormulasAdapter */ {

    event FormulasAdapter_ERC721_Sent(address indexed token, address indexed from, address indexed to, uint256 tokenId);

    /**
        Transfers ownership of selected ERC721 token from one party to the other.
        Expects to be allowed (via `erc721.approve()` or preferably `erc721.setApprovalForAll`) to send funds owned by `from` party.
    */
    function erc721_transferValue(address token, address from, address to, uint256 tokenId) internal {
        IERC721(token).transferFrom(from, to, tokenId);

        emit FormulasAdapter_ERC721_Sent(token, from, to, tokenId);
    }
}

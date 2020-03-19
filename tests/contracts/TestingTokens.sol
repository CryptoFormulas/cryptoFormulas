//import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol'; // can't be used now because Open-Zeppelin doesn't support solidity 0.6.x yet
//import 'openzeppelin-solidity/contracts/token/ERC721/ERC721.sol'; // can't be used now because Open-Zeppelin doesn't support solidity 0.6.x yet
import './upgradedZeppelin/token/ERC20/ERC20.sol';
import './upgradedZeppelin/token/ERC721/ERC721.sol';

/**
    Minimal ERC20 contract that allocates tokens to owner during deployment.
*/
contract TestingERC20 is ERC20 {

    constructor () public {
        _mint(msg.sender, 10 ** 10);
    }
}

/**
    Minimal ERC721 contract that allocates tokens to owner during deployment.
*/
contract TestingERC721 is ERC721 {

    constructor () public {
        _mint(msg.sender, 0);
        _mint(msg.sender, 1);
        _mint(msg.sender, 2);
    }

    /*
        Expose internal _mint function to everybody to enable minting tokens with custom id.
    */
    function mint(address account, uint256 tokenId) external {
        _mint(account, tokenId);
    }
}

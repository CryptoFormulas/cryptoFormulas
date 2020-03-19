//import 'openzeppelin-solidity/contracts/math/SafeMath.sol'; // can't be used now because Open-Zeppelin doesn't support solidity 0.6.x yet
//import 'openzeppelin-solidity/contracts/utils/Address.sol'; // can't be used now because Open-Zeppelin doesn't support solidity 0.6.x yet
import './libraries/SafeMath.sol';
import './libraries/Address.sol';

import './interfaces/Ownable.sol';

import './transferAdapters/ERC20.sol';
import './transferAdapters/ERC721.sol';
import './transferAdapters/Ether.sol';

/**
    Contract enabling withdrawal of donations. Assets recieved from unexpected sources are considered donations.
*/
contract DonationWithdrawal is Ownable, FormulasAdapter_Ether, FormulasAdapter_ERC721, FormulasAdapter_ERC20 {

    event DonationWithdrawal_Withdraw(uint8 resourceType, address to, uint256 amount, address tokenAddress);

    using SafeMath for uint256;

    /**
        Withdraws donations of selected asset type from the contract selected address.

        All assets recieved from unexpected sources are considered donations. These might include sending ERC20/721 tokens directly
        to the Crypto Formulas contract (as there is no way to trigger custom logic on such event), etc.
    */
    function withdrawDonations(uint8 resourceType, address payable to, uint256 amountOrId, address tokenAddress) external onlyOwner {
        // ether
        if (resourceType == 0) {
            require(amountOrId <= address(this).balance.sub(etherTotalBalance), 'Insufficient balance to withdraw');
            Address.sendValue(to, amountOrId);

            emit DonationWithdrawal_Withdraw(resourceType, to, amountOrId, address(0));
            return;
        }

        // Warning: following implementation of token withdrawals assumes zero 3rd balance managed by this contract
        //          all tokens belonging directly(!) to this contract are considered donations.

        // erc20
        if (resourceType == 1) {
            IERC20(tokenAddress).transfer(to, amountOrId);

            emit DonationWithdrawal_Withdraw(resourceType, to, amountOrId, tokenAddress);
            return;
        }

        // erc721
        if (resourceType == 2) {
            IERC721(tokenAddress).transferFrom(address(this), to, amountOrId);

            emit DonationWithdrawal_Withdraw(resourceType, to, amountOrId, tokenAddress);
            return;
        }

        revert('Invalid type');
    }
}

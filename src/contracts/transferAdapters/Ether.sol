pragma solidity ^0.6.0;

//import 'openzeppelin-solidity/contracts/math/SafeMath.sol'; // can't be used now because Open-Zeppelin doesn't support solidity 0.6.x yet
//import 'openzeppelin-solidity/contracts/utils/Address.sol'; // can't be used now because Open-Zeppelin doesn't support solidity 0.6.x yet
import '../libraries/SafeMath.sol';
import '../libraries/Address.sol';


/**
    Adapter for manipulating Ether.
*/
contract FormulasAdapter_Ether /* is FormulasAdapter */ {

    event FormulasAdapter_Ether_Recieved(address indexed from, uint256 amount);
    event FormulasAdapter_Ether_Sent(address indexed from, address indexed to, uint256 amount);
    event FormulasAdapter_Ether_SentInside(address indexed from, address indexed to, uint256 amount);
    event FormulasAdapter_Ether_Withdrawal(address indexed to, uint256 amount);

    using SafeMath for uint256;

    mapping(address => uint256) public etherBalances; // inner ledger
    // total balance properly recieved; this is used to distinguish ether recieved from unexpected sources that are considered donations
    uint256 public etherTotalBalance;

    /**
        Transfers selected amount of Ether from one party to the other.
        Balance is changed only inside the Crypto Formulas contract's inner ledger.
    */
    function ether_transferValue(address from, address payable to, uint256 amount) internal {
        etherBalances[from] = etherBalances[from].sub(amount);
        if (to != address(this)) {
            etherTotalBalance = etherTotalBalance.sub(amount);
        }
        Address.sendValue(to, amount);

        emit FormulasAdapter_Ether_Sent(from, to, amount);
    }

    /**
        Transfers selected amount of Ether from one party to the other.
        Balance is substracted from Crypto Formulas contract's inner ledger and sent directly to ethereum address.
        This can be understand as Withdrawal of Ether from the Crypto Formulas contract.
    */
    function ether_transferValueInside(address from, address to, uint256 amount) internal {
        etherBalances[from] = etherBalances[from].sub(amount);
        etherBalances[to] = etherBalances[to].add(amount);

        emit FormulasAdapter_Ether_SentInside(from, to, amount);
    }


    /**
        Add recieved Ether to inner ledger.

        Call this in contract's `function () payable` or whetever it accept ether.
    */
    function ether_recieve(address from, uint256 amount) internal {
        etherBalances[from] = etherBalances[from].add(amount);
        etherTotalBalance = etherTotalBalance.add(amount);

        emit FormulasAdapter_Ether_Recieved(from, amount);
    }
}

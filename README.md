# Crypto Formulas

[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

Crypto Formulas is Ethereum contract written in Solidity that brings new ways of interaction
with the most popular Ethereum based assets (Ether, ERC20 tokens, and ERC721 tokens).
Using it, you can create sequences of operations that are executed atomically (all of them or none at all).
Each operation is made of instruction, and it's operands.

Examples of such instructions are:
- "Send Ether amount X from A to B"
- "Send amount X of ERC20 token Y from A to B"
- "Allow executing this transaction only during October 2020"

and more exists.

These simple instructions can be composed together for secure exchange for Ethereum based assets and other practical uses.


# Install
```
yarn # install dependencies

yarn build # build contracts
yarn test # test contracts
```

# Use

## Contract
After building, you can find deployable source code in the file `dist/src/contracts/CryptoFormulas.sol.`
The main contract you want to deploy is called `CryptoFormulas.`

## Typescript API
The repository contains a Crypto Formulas' Formula wrapper class that helps you construct Formulas that
can be relayed to Ethereum network later on. Deploy mechanism is not included in this project
and you will need to look for projects `web3x`, `web3js`, [Remix](https://remix.ethereum.org)
or similar to deploy the contract.

Example usage
```
import {Formula} from 'cryptoFormulas/src/formula/Formula'
import {IFormula} from 'cryptoFormulas/src/formula/IFormula'

// two parties exchange erc20 tokens for ethereum
const amountToken = 100
const amountEther = 100
const tokenContractAddress = '0x...' // fill erc20 contract address here

const myFormula: IFormula = new Formula({
    endpoints: [
        '0x10027177ce11c9f2a875cb40e74f06a740833b36'
    ],
    operations: [
        { // send token user1 -> user2
            instruction: 1,
            operands: [0, 1, amountToken, token1Contract.address]
        }, { // send ether user2 -> user1
            instruction: 0,
            operands: [1, 0, amountEther]
        }
    ]
})

// Now let the parties sign the formula, relay it to Ethereum network, or do whatever you need to do.

```
See tests for more usage examples.

If you are using plain JS, you will need to build the project first and then use generated JS files
located in `dist/src/formula/`.

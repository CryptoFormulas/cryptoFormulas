import {assert} from 'chai'
import {testingTools} from 'soliditySapper'
import {Eth} from 'web3x/eth'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'
import {Contract} from 'web3x/contract'
import {analyzeFormula, ErrorTypes, IAnalyzerResultError} from '../../src/formula/analysis'
import {emptyAnalysis} from '../../src/formula/analysis/IFormulaAnalysis'
import {Formula} from '../../src/formula/Formula'
import {deployFormulas, deployERC20, deployERC721} from './formulaTest'
import {PresignStates, emptyAssetState} from '../../src/formula/analysis'
import {topupAccounts, ITopupEnvironment} from '../shared/topup'
import {bigNumberify} from 'web3x/ethers/bignumber'
import {CommonErrorReasons, ErrorReasons_000, ErrorReasons_001, ErrorReasons_002, ErrorReasons_003, ErrorReasons_004, ErrorReasons_005} from '../../src/formula/instructions'


const contractNames = {
    formulas: 'CryptoFormulas:CryptoFormulas',
    erc20: 'TestingTokens:TestingERC20',
    erc721: 'TestingTokens:TestingERC721'
}

const tmpGas = {gas: 1000000, gasPrice: 2000}

/**
    Top ups ether to Crypto Formulas contract on behalf of given account.
*/
async function topupEther(eth: Eth, formulasContract: Contract, from: Address, to: Account, amount: number) {
    // topup ether to account
    await eth.sendTransaction({from: from, to: to.address, value: amount + tmpGas.gas * tmpGas.gasPrice})

    // from account topup ether to Crypto Formulas contract
    const tx = formulasContract.methods.topUpEther()
    const sendTx = await to.sendTransaction({to: formulasContract.address, value: amount, data: tx.encodeABI(), ...tmpGas}, eth)
    await sendTx.getTxHash() // wait for transaction to be mined
}

const testFormulaAnalyzer = (prerequisities: testingTools.IPrerequisities) => () => {
    let tokenErc20Contract: Contract
    let tokenErc721Contract: Contract
    let formulasContract: Contract
    let formulasDeployer: Address
    let tokenErc20Deployer: Address
    let tokenErc721Deployer: Address

    const abiGetter = async (name: 'formulas' | 'erc20' | 'erc721') => {
        const nameParts = contractNames[name].split(':')
        const abi = prerequisities.servant.compiledContracts.contracts[nameParts[0]][nameParts[1]].abi

        return abi
    }

    beforeEach(async () => {
        ({contract: formulasContract, deployer: formulasDeployer} = await deployFormulas(prerequisities, true));
        ({contract: tokenErc20Contract, deployer: tokenErc20Deployer} = await deployERC20(prerequisities));
        ({contract: tokenErc721Contract, deployer: tokenErc721Deployer} = await deployERC721(prerequisities))
    })

    function testEtherInstruction(instruction: number, senderCanBeTarget: boolean) {
        it('sender address empty', async () => {
            const amount = 4500

            const accounts = [Account.create(), Account.create()]
            const formulaData = {
                endpoints: [Address.ZERO, accounts[1].address],
                operations: [
                    {
                        instruction,
                        operands: [0, 1, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, instruction)
            assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.senderEmpty)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
        })

        it('target address empty', async () => {
            const amount = 4500

            const accounts = [Account.create()]
            topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formulaData = {
                endpoints: [accounts[0].address, Address.ZERO],
                operations: [
                    {
                        instruction,
                        operands: [0, 1, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, instruction)
            assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.targetEmpty)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
        })

        it('insufficient funds', async () => {
            const amount = 4500
            const accounts = [Account.create(), Account.create()]

            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount - 1)

            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction,
                        operands: [0, 1, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, instruction)
            assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.insufficientEtherInternal)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
        })

        if (!senderCanBeTarget) {
            it('sender is target', async () => {
                const amount = 4500
                const accounts = [Account.create()]

                await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

                const formulaData = {
                    endpoints: [accounts[0].address],
                    operations: [
                        {
                            instruction,
                            operands: [0, 0, amount]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, instruction)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.senderIsTarget)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })
        }

        it('target is contract', async () => {
            const amount = 4500
            const accounts = [Account.create()]
            const dummyContractAddress = tokenErc20Contract.address // any address where contract is deployed is ok

            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formulaData = {
                endpoints: [accounts[0].address, dummyContractAddress],
                operations: [
                    {
                        instruction,
                        operands: [0, 1, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, instruction)
            assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.targetIsContract)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
        })

        it('operation ok', async () => {
            const amount = 4500
            const accounts = [Account.create(), Account.create()]

            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction,
                        operands: [0, 1, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 0)
        })
    }

    describe('Instructions', () => {
        describe('send ether inner', async () => {
            testEtherInstruction(0, false)
        })

        describe('send ether', async () => {
            testEtherInstruction(3, true)
        })


        describe('send erc20', async () => {
            it('sender address empty', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [Address.ZERO, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.senderEmpty)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('target address empty', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc20Contract.methods.transfer(accounts[0].address, amount).send({from: tokenErc20Deployer})
                // approve allowance for Crypto Formulas contract
                const tx = await tokenErc20Contract.methods.approve(formulasContract.address, amount)
                await accounts[0].sendTransaction({to: tokenErc20Contract.address, data: tx.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()

                const formulaData = {
                    endpoints: [accounts[0].address, Address.ZERO],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.targetEmpty)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('token address empty', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc20Contract.methods.transfer(accounts[0].address, amount).send({from: tokenErc20Deployer})

                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, Address.ZERO]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.tokenEmpty)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('no contract at token address', async () => {
                const amount = 4500

                const invalidTokenAddress = Account.create().address

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, invalidTokenAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.noContractAtTokenAddress)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('no erc20 contract at token address', async () => {
                const amount = 4500

                const invalidTokenAddress = formulasContract.address

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, invalidTokenAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_001.noErc20ContractAtAddress)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('insufficient erc20 balance', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_001.insufficientErc20Balance)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('insufficient erc20 allowance', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc20Contract.methods.transfer(accounts[0].address, amount).send({from: tokenErc20Deployer})

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_001.insufficientErc20Allowance)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('sender is target', async () => {
                const amount = 4500

                const accounts = [Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 0, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc20Contract.methods.transfer(accounts[0].address, amount).send({from: tokenErc20Deployer})
                // approve allowance for Crypto Formulas contract
                const tx = await tokenErc20Contract.methods.approve(formulasContract.address, amount)
                await accounts[0].sendTransaction({to: tokenErc20Contract.address, data: tx.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)


                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.senderIsTarget)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('target is contract', async () => {
                const amount = 4500

                const accounts = [Account.create()]
                const dummyContractAddress = tokenErc20Contract.address // any address where contract is deployed is ok

                const formulaData = {
                    endpoints: [accounts[0].address, dummyContractAddress],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc20Contract.methods.transfer(accounts[0].address, amount).send({from: tokenErc20Deployer})
                // approve allowance for Crypto Formulas contract
                const tx = await tokenErc20Contract.methods.approve(formulasContract.address, amount)
                await accounts[0].sendTransaction({to: tokenErc20Contract.address, data: tx.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 1)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.targetIsContract)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('operation ok', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, tokenErc20Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc20Contract.methods.transfer(accounts[0].address, amount).send({from: tokenErc20Deployer})
                // approve allowance for Crypto Formulas contract
                const tx = await tokenErc20Contract.methods.approve(formulasContract.address, amount)
                await accounts[0].sendTransaction({to: tokenErc20Contract.address, data: tx.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 0)
            })
        })

        describe('send erc721', async () => {
            it('sender address empty', async () => {
                const tokenId = 1

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [Address.ZERO, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, tokenErc721Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.senderEmpty)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('target address empty', async () => {
                const tokenId = 1

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, Address.ZERO],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, tokenErc721Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.targetEmpty)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('token address empty', async () => {
                const tokenId = 1

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, Address.ZERO]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.tokenEmpty)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('no contract at token address', async () => {
                const tokenId = 1

                const invalidTokenAddress = Account.create().address

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, invalidTokenAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.noContractAtTokenAddress)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('no erc721 contract at token address', async () => {
                const tokenId = 1

                const invalidTokenAddress = formulasContract.address

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, invalidTokenAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_002.noErc721ContractAtAddress)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
            })

            it('not token\'s owner', async () => {
                const tokenId = 1

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, tokenErc721Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // approve allowance for Crypto Formulas contract
                await tokenErc721Contract.methods.approve(formulasContract.address, tokenId).send({from: tokenErc721Deployer})

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_002.noErc721TokenOwner)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('insufficient erc721 allowance', async () => {
                const tokenId = 1

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, tokenErc721Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc721Contract.methods.transferFrom(tokenErc721Deployer, accounts[0].address, tokenId).send({from: tokenErc721Deployer, ...tmpGas})

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_002.noErc721Approval)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('target is contract', async () => {
                const tokenId = 1

                const accounts = [Account.create()]
                const dummyContractAddress = tokenErc20Contract.address // any address where contract is deployed is ok

                const formulaData = {
                    endpoints: [accounts[0].address, dummyContractAddress],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, tokenErc721Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc721Contract.methods.transferFrom(tokenErc721Deployer, accounts[0].address, tokenId).send({from: tokenErc721Deployer, ...tmpGas})
                // approve allowance for Crypto Formulas contract
                const tx = await tokenErc721Contract.methods.approve(formulasContract.address, tokenId)
                await accounts[0].sendTransaction({to: tokenErc721Contract.address, data: tx.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 1)
                assert.equal(analysis.operations[0][0].instructionCode, 2)
                assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.targetIsContract)
                assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
            })

            it('operation ok', async () => {
                const tokenId = 1

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, tokenErc721Contract.address]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // topup ether to account for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[0].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
                // give tokens to account
                await tokenErc721Contract.methods.transferFrom(tokenErc721Deployer, accounts[0].address, tokenId).send({from: tokenErc721Deployer, ...tmpGas})
                // approve allowance for Crypto Formulas contract
                const tx = await tokenErc721Contract.methods.approve(formulasContract.address, tokenId)
                await accounts[0].sendTransaction({to: tokenErc721Contract.address, data: tx.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)
                assert.equal(analysis.operations.length, 1)
                assert.equal(analysis.operations[0].length, 0)
            })
        })

    })

    describe('AssetBalanceLogic', () => {
        describe('Instructions', () => {
            it('#0 - send ether', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 0,
                            operands: [0, 1, amount]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedExtremes = {
                    etherInternal: {
                        0: bigNumberify(amount)
                    },
                    etherExternal: {},
                    erc20Balance: {},
                    erc721Balance: {},
                    erc20Allowance: {},
                    erc721Allowance: {},
                }
                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: expectedExtremes,
                    missing: expectedExtremes
                }
                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })

            it('#1 - send erc20', async () => {
                const accounts = [Account.create(), Account.create()]
                const amount = 4500
                const contractAddress = tokenErc20Contract.address

                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, contractAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedExtremes = {
                    etherInternal: {},
                    etherExternal: {},
                    erc20Balance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(amount)
                        }
                    },
                    erc721Balance: {},
                    erc20Allowance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(amount)
                        }
                    },
                    erc721Allowance: {},
                }
                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: expectedExtremes,
                    missing: expectedExtremes
                }

                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })

            it('#2 - send erc721', async () => {
                const accounts = [Account.create(), Account.create(), Account.create()]
                const tokenId = bigNumberify(1)
                const contractAddress = tokenErc721Contract.address

                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 2,
                            operands: [0, 1, tokenId, contractAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedExtremes = {
                    etherInternal: {},
                    etherExternal: {},
                    erc20Balance: {},
                    erc721Balance: {
                        0: {
                            [contractAddress.toString()]: [tokenId]
                        }
                    },
                    erc20Allowance: {},
                    erc721Allowance: {
                        0: {
                            [contractAddress.toString()]: [tokenId]
                        }
                    },
                }
                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: expectedExtremes,
                    missing: expectedExtremes
                }
                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })

            it('#3 - withdraw ether', async () => {
                const amount = 4500

                const accounts = [Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 3,
                            operands: [0, 1, amount]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedExtremes = {
                    etherInternal: {
                        0: bigNumberify(amount)
                    },
                    etherExternal: {},
                    erc20Balance: {},
                    erc721Balance: {},
                    erc20Allowance: {},
                    erc721Allowance: {},
                }
                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: expectedExtremes,
                    missing: expectedExtremes
                }
                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })

            it('#4 - pay fee', async () => {
                const formulaFee = bigNumberify(await formulasContract.methods.feePerOperation().call())

                const accounts = [Account.create(), Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 4,
                            operands: [0, formulaFee]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedExtremes = {
                    etherInternal: {
                        0: formulaFee
                    },
                    etherExternal: {},
                    erc20Balance: {},
                    erc721Balance: {},
                    erc20Allowance: {},
                    erc721Allowance: {},
                }
                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: expectedExtremes,
                    missing: expectedExtremes
                }
                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })

            it('#5 - time condition', async () => {
                const formulaFee = bigNumberify(await formulasContract.methods.feePerOperation().call())

                const accounts = [Account.create(), Account.create(), Account.create()]
                const formulaData = {
                    endpoints: [accounts[0].address],
                    operations: [
                        {
                            instruction: 5,
                            operands: [0, 0]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: emptyAssetState,
                    missing: emptyAssetState
                }
                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })
        })

        describe('ERC20/721 token allowance', () => {
            it('ERC20 insufficient allowance', async () => {
                const accounts = [Account.create(), Account.create()]
                const amount = 4500
                const missingAllowance = 1000

                const totalAmount = amount * 2
                const allowance = totalAmount - missingAllowance
                const contractAddress = tokenErc20Contract.address

                assert.isTrue(amount < allowance && allowance < totalAmount) // sanity check

                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        {
                            instruction: 1,
                            operands: [0, 1, amount, contractAddress]
                        }, {
                            instruction: 1,
                            operands: [0, 1, amount, contractAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                // give endpoint 0 the required amount of er20 token but set insufficient allowance
                const topupEnv: ITopupEnvironment = {
                    prerequisities,
                    universalDonor: formulasDeployer,
                    formulasContract,
                    tokenErc20Contract,
                    tokenErc721Contract
                }
                const topupBalance = {
                    0: {
                        tokenErc20: totalAmount, // let's add some extra balance to strengthen test
                    }
                }
                await topupAccounts(accounts.slice(0, 1), topupBalance, topupEnv)
                //set insufficient allowance
                const allowanceTxData = tokenErc20Contract.methods.approve(formulasContract.address, allowance).encodeABI()
                await accounts[0].sendTransaction({data: allowanceTxData, to: tokenErc20Contract.address, ...tmpGas}, prerequisities.servant.eth).getReceipt()

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const startingBalances = {
                    ...emptyAssetState,
                    erc20Balance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(totalAmount)
                        }
                    },
                    erc20Allowance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(allowance)
                        }
                    },
                }
                const expectedExtremes = {
                    ...emptyAssetState,
                    erc20Balance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(totalAmount)
                        }
                    },
                    erc20Allowance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(totalAmount)
                        }
                    },
                }
                const expectedMissing = {
                    ...emptyAssetState,
                    erc20Allowance: {
                        0: {
                            [contractAddress.toString()]: bigNumberify(totalAmount - allowance)
                        }
                    },
                }
                const expectedBalances = {
                    starting: startingBalances,
                    neededExtremes: expectedExtremes,
                    missing: expectedMissing
                }

                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })

            it('ERC721 token ping pong fails due to allowance', async () => {
                const accounts = [Account.create(), Account.create(), Account.create()]
                const tokenId = bigNumberify(1)
                const contractAddress = tokenErc721Contract.address

                const formulaData = {
                    endpoints: [accounts[0].address, accounts[1].address],
                    operations: [
                        { // send token
                            instruction: 2,
                            operands: [0, 1, tokenId, contractAddress]
                        }, { // send token back
                            instruction: 2,
                            operands: [1, 0, tokenId, contractAddress]
                        }, { // send toekn again
                            instruction: 2,
                            operands: [0, 1, tokenId, contractAddress]
                        }
                    ]
                }

                const formula = new Formula(formulaData)

                const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

                const expectedExtremes = {
                    ...emptyAssetState,
                    erc721Balance: {
                        0: {
                            [contractAddress.toString()]: [tokenId]
                        }
                    },
                    erc721Allowance: {
                        0: {
                            // tokenId twice in array might seem awkward but it is intended
                            [contractAddress.toString()]: [tokenId, tokenId]
                        },
                        1: {
                            [contractAddress.toString()]: [tokenId]
                        }
                    },
                }
                const expectedBalances = {
                    starting: emptyAssetState,
                    neededExtremes: expectedExtremes,
                    missing: expectedExtremes
                }
                assert.deepEqual(analysis.assetsBalances, expectedBalances)
            })
        })

        it('send -> send', async () => {
            const amount = 4500

            const accounts = [Account.create(), Account.create(), Account.create()]
            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }, {
                        instruction: 0,
                        operands: [0, 2, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount).mul(2),
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedBalances = {
                starting: emptyAssetState,
                neededExtremes: expectedExtremes,
                missing: expectedExtremes
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)
        })

        it('send -> recieve -> send', async () => {
            const amount = 4500

            const accounts = [Account.create(), Account.create(), Account.create(), Account.create()]
            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }, {
                        instruction: 0,
                        operands: [2, 0, amount]
                    }, {
                        instruction: 0,
                        operands: [0, 3, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount),
                    2: bigNumberify(amount)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedBalances = {
                starting: emptyAssetState,
                neededExtremes: expectedExtremes,
                missing: expectedExtremes
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)
        })

        it('recieve -> send with no initial balance', async () => {
            const amount = 4500

            const accounts = [Account.create(), Account.create(), Account.create()]
            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }, {
                        instruction: 0,
                        operands: [1, 2, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount),
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedBalances = {
                starting: emptyAssetState,
                neededExtremes: expectedExtremes,
                missing: expectedExtremes
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)
        })

        it('send ether to myself', async () => {
            const amount = 4500

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 0, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount),
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedBalances = {
                starting: emptyAssetState,
                neededExtremes: expectedExtremes,
                missing: expectedExtremes
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)
        })

        it('starting balance fetch', async () => {
            const accounts = Array(3).fill(0).map(item => Account.create())
            const amount = 4500
            const amountExtra = 100
            const tokenId1 = bigNumberify(1)
            const tokenId2 = bigNumberify(2)
            const erc20Address = tokenErc20Contract.address
            const erc721Address = tokenErc721Contract.address

            // prepare formula
            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address, accounts[2].address],
                operations: [
                    // send ether operations
                    {
                        instruction: 0,
                        operands: [0, 2, amount]
                    }, {
                        instruction: 0,
                        operands: [1, 2, amount]
                    },

                    // send erc20 operations
                    {
                        instruction: 1,
                        operands: [0, 2, amount, erc20Address]
                    }, {
                        instruction: 1,
                        operands: [1, 2, amount, erc20Address]
                    },

                    // send erc721 operations
                    {
                        instruction: 2,
                        operands: [0, 2, tokenId1, erc721Address]
                    }, {
                        instruction: 2,
                        operands: [1, 2, tokenId2, erc721Address]
                    }
                ]
            }

            // topup initial balances
            const startingBalance = {
                0: {
                    ethInner: amount + amountExtra, // let's add some extra balance to strengthen test
                    tokenErc20: amount + amountExtra, // let's add some extra balance to strengthen test
                    tokenErc721: [tokenId1]
                },
                1: {
                    ethInner: amount + amountExtra, // let's add some extra balance to strengthen test
                    tokenErc20: amount + amountExtra, // let's add some extra balance to strengthen test
                    tokenErc721: [tokenId2]
                }
            }
            const topupEnv: ITopupEnvironment = {
                prerequisities,
                universalDonor: formulasDeployer,
                formulasContract,
                tokenErc20Contract,
                tokenErc721Contract
            }
            await topupAccounts(accounts.slice(0, 2), startingBalance, topupEnv)

            // analyze
            const formula = new Formula(formulaData)
            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            // assert
            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount),
                    1: bigNumberify(amount)
                },
                etherExternal: {},
                erc20Balance: {
                    0: {
                        [erc20Address.toString()]: bigNumberify(amount)
                    },
                    1: {
                        [erc20Address.toString()]: bigNumberify(amount)
                    }
                },
                erc721Balance: {
                    0: {
                        [erc721Address.toString()]: [tokenId1]
                    },
                    1: {
                        [erc721Address.toString()]: [tokenId2]
                    }
                },
                erc20Allowance: {
                    0: {
                        [erc20Address.toString()]: bigNumberify(amount)
                    },
                    1: {
                        [erc20Address.toString()]: bigNumberify(amount)
                    }
                },
                erc721Allowance: {
                    0: {
                        [erc721Address.toString()]: [tokenId1]
                    },
                    1: {
                        [erc721Address.toString()]: [tokenId2]
                    }
                },
            }
            const expectedStarting = {
                etherInternal: {
                    0: bigNumberify(amount + amountExtra),
                    1: bigNumberify(amount + amountExtra)
                },
                etherExternal: {},
                erc20Balance: {
                    0: {
                        [erc20Address.toString()]: bigNumberify(amount + amountExtra)
                    },
                    1: {
                        [erc20Address.toString()]: bigNumberify(amount + amountExtra)
                    }
                },
                erc721Balance: {
                    0: {
                        [erc721Address.toString()]: [tokenId1]
                    },
                    1: {
                        [erc721Address.toString()]: [tokenId2]
                    }
                },
                erc20Allowance: {
                    0: {
                        [erc20Address.toString()]: bigNumberify(amount + amountExtra)
                    },
                    1: {
                        [erc20Address.toString()]: bigNumberify(amount + amountExtra)
                    }
                },
                erc721Allowance: {
                    0: {
                        [erc721Address.toString()]: Infinity
                    },
                    1: {
                        [erc721Address.toString()]: Infinity
                    }
                },
            }
            const expectedBalances = {
                starting: expectedStarting,
                neededExtremes: expectedExtremes,
                missing: emptyAssetState
            }

            assert.deepEqual(analysis.assetsBalances, expectedBalances)
        })

        it('partially missing assets calculate properly', async () => {
            const amount = 4500
            const amountExtra = 100
            // TODO: topup

            const accounts = [Account.create(), Account.create(), Account.create()]
            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount + amountExtra]
                    }
                ]
            }

            // topup initial balances
            const startingBalance = {
                0: {
                    ethInner: amount
                }
            }
            const topupEnv: ITopupEnvironment = {
                prerequisities,
                universalDonor: formulasDeployer,
                formulasContract,
                tokenErc20Contract,
                tokenErc721Contract
            }
            await topupAccounts(accounts.slice(0, 1), startingBalance, topupEnv)

            // analyze
            const formula = new Formula(formulaData)
            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            // assert
            const expectedBalances = {
                starting: {
                    ...emptyAssetState,
                    etherInternal: {
                        0: bigNumberify(amount),
                    }
                },
                neededExtremes: {
                    ...emptyAssetState,
                    etherInternal: {
                        0: bigNumberify(amount + amountExtra),
                    }
                },
                missing: {
                    ...emptyAssetState,
                    etherInternal: {
                        0: bigNumberify(amountExtra)
                    }
                }
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)
        })

    })

    describe('fee', () => {
        it('is missing', async () => {
            const amount = 4500

            const accounts = [Account.create(), Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.isTrue(analysis.feeMissing)
            assert.isFalse(analysis.feeIsLow)
        })

        it('is too low', async () => {
            const amount = 4500
            const feePerOperation = await formulasContract.methods.feePerOperation().call()
            const operationCount = 2
            const validFee = feePerOperation * operationCount
            const invalidFee = validFee - 1

            const accounts = [Account.create(), Account.create()]
            topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount + validFee)

            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }, {
                        instruction: 4,
                        operands: [0, invalidFee]
                    },

                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.isFalse(analysis.feeMissing)
            assert.isTrue(analysis.feeIsLow)

            assert.equal(analysis.operations.length, 2)
            assert.equal(analysis.operations[0].length, 0)
            assert.equal(analysis.operations[1][0].instructionCode, 4)
            assert.equal(analysis.operations[1][0].errorReason, ErrorReasons_004.feeTooLow)
        })

        it('insufficient balance to pay fee', async () => {
            const amount = 4500
            const feePerOperation = await formulasContract.methods.feePerOperation().call()
            const fee = feePerOperation

            const accounts = [Account.create(), Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction: 4,
                        operands: [0, fee]
                    },

                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.isFalse(analysis.feeMissing)
            assert.isFalse(analysis.feeIsLow)
            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, 4)
            assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_004.insufficientEtherInternalForFee)
        })

        it('sender address empty', async () => {
            const amount = 4500
            const feePerOperation = await formulasContract.methods.feePerOperation().call()
            const operationCount = 2
            const fee = feePerOperation * operationCount

            const formulaData = {
                endpoints: [Address.ZERO],
                operations: [
                    {
                        instruction: 4,
                        operands: [0, fee]
                    },

                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.isFalse(analysis.feeMissing)
            assert.isFalse(analysis.feeIsLow)
            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, 4)
            assert.equal(analysis.operations[0][0].errorReason, CommonErrorReasons.senderEmpty, 1)
        })

        it('is ok', async () => {
            const amount = 4500
            const feePerOperation = await formulasContract.methods.feePerOperation().call()
            const operationCount = 2
            const fee = feePerOperation * operationCount

            const accounts = [Account.create(), Account.create()]
            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount + fee)

            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }, {
                        instruction: 4,
                        operands: [0, fee]
                    },

                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.isFalse(analysis.feeMissing)
            assert.isFalse(analysis.feeIsLow)
            assert.equal(analysis.operations.length, 2)
            assert.equal(analysis.operations[0].length, 0)
            assert.equal(analysis.operations[1].length, 0)
        })
    })

    describe('Time condition', async () => {
        it('is ok', async () => {
            const blockNumber = await prerequisities.servant.eth.getBlockNumber()

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address],
                operations: [
                    {
                        instruction: 5,
                        operands: [blockNumber, blockNumber + 10]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 0)
        })

        it('one block only is ok', async () => {
            const blockNumber = await prerequisities.servant.eth.getBlockNumber()

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address],
                operations: [
                    {
                        instruction: 5,
                        operands: [blockNumber, blockNumber]
                        //operands: [blockNumber - 10, blockNumber + 10]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0].length, 0)
        })

        it('minimum block not reached yet', async () => {
            const blockNumber = await prerequisities.servant.eth.getBlockNumber()

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address],
                operations: [
                    {
                        instruction: 5,
                        operands: [blockNumber + 1, 0]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, 5)
            assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_005.minimumBlockNotReached)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
        })

        it('maximum block already reached', async () => {
            const blockNumber = await prerequisities.servant.eth.getBlockNumber()

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address],
                operations: [
                    {
                        instruction: 5,
                        operands: [0, blockNumber - 1]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, 5)
            assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_005.maximumBlockAlreadyPassed)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
        })

        it('maximum is less than minimum', async () => {
            const blockNumber = await prerequisities.servant.eth.getBlockNumber()

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address],
                operations: [
                    {
                        instruction: 5,
                        operands: [blockNumber + 1, blockNumber]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, 5)
            assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_005.minimumBlockHigherThanMaximum)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.error)
        })

        it('neither minimum or maximum set', async () => {
            const blockNumber = await prerequisities.servant.eth.getBlockNumber()

            const accounts = [Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address],
                operations: [
                    {
                        instruction: 5,
                        operands: [0, 0]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.operations.length, 1)
            assert.equal(analysis.operations[0][0].instructionCode, 5)
            assert.equal(analysis.operations[0][0].errorReason, ErrorReasons_005.noTimeConditionSet)
            assert.equal(analysis.operations[0][0].errorType, ErrorTypes.warning)
        })
    })

    it('isEmpty', async () => {
        const formula = new Formula()

        const preAnalysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)
        assert.isTrue(preAnalysis.isEmpty)
        assert.isNull(preAnalysis.alreadyExecuted)

        const {operations, totals, presignes, assetsBalances, ...tmp} = preAnalysis
        assert.equal(operations.length, 0)
        assert.equal(totals.errors, 1) // one error for 'isEmpty' sign
        assert.equal(totals.warnings, 0)
        assert.equal(presignes.length, formula.endpoints.length)

        presignes.map(item => assert.equal(item, PresignStates.defaultValue))
        Object.keys(assetsBalances).map(key => assert.deepEqual(assetsBalances[key], emptyAssetState))

        assert.equal(formula, preAnalysis.formula)
        assert.isTrue(preAnalysis.isComplete)

        const skip = ['isComplete', 'isEmpty', 'alreadyExecuted', 'formula']
        Object.keys(tmp).map(key => !skip.includes(key) && assert.isFalse(tmp[key]))
    })

    it('analysis with web3 unavailable', async () => {
        const amount = 4500
        const accounts = [Account.create()]

        const formulaData = {
            endpoints: [accounts[0].address, Address.ZERO],
            operations: [
                {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ]
        }

        const formula = new Formula(formulaData)

        const analysisStatic = await analyzeFormula(null, formula, formulasContract.address, abiGetter)
        assert.isFalse(analysisStatic.isComplete)
        assert.equal(analysisStatic.operations.length, 1)
        assert.equal(analysisStatic.operations[0].length, 1)
        assert.equal(analysisStatic.operations[0][0].errorReason, CommonErrorReasons.targetEmpty)

        const analysisFull = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)
        assert.isTrue(analysisFull.isComplete)
        assert.equal(analysisFull.operations.length, 1)
        assert.equal(analysisFull.operations[0].length, 2)
        assert.equal(analysisFull.operations[0][0].errorReason, CommonErrorReasons.targetEmpty)
        assert.equal(analysisFull.operations[0][1].errorReason, CommonErrorReasons.insufficientEtherInternal)
    })

    it('already executed', async () => {
        const feePerOperation = await formulasContract.methods.feePerOperation().call()
        const operationCount = 1
        const fee = feePerOperation * operationCount

        const accounts = [Account.create()]
        const formulaData = {
            endpoints: [accounts[0].address],
            operations: [
                {
                    instruction: 4,
                    operands: [0, fee]
                },
            ]
        }

        await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], fee)

        const tmpFormula = new Formula(formulaData)
        const formula = new Formula({
            ...tmpFormula,
            signatures: [
                accounts[0].sign(tmpFormula.messageHash).signature
            ]
        })

        const preAnalysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)
        assert.isNull(preAnalysis.alreadyExecuted)

        const blockNumberPre = await prerequisities.eth.getBlockNumber()
        const response = await formulasContract.methods.executeFormula(formula.compile()).send({from: formulasDeployer, ...tmpGas}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)

        const postAnalysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)
        assert.isOk(postAnalysis.alreadyExecuted)

        const block = await prerequisities.eth.getBlock(blockNumberPre + 1)
        assert.isOk(postAnalysis.alreadyExecuted)
        assert.equal(postAnalysis.alreadyExecuted.timestamp, block.timestamp)
        assert.equal(postAnalysis.alreadyExecuted.number, block.number)
    })

    it('stop on already executed', async () => {
        const feePerOperation = await formulasContract.methods.feePerOperation().call()
        const operationCount = 1
        const fee = feePerOperation * operationCount

        const accounts = [Account.create()]
        const formulaData = {
            endpoints: [accounts[0].address],
            operations: [
                {
                    instruction: 4,
                    operands: [0, fee]
                },
            ]
        }

        await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], fee + 10000000)

        const tmpFormula = new Formula(formulaData)
        const formula = new Formula({
            ...tmpFormula,
            signatures: [
                accounts[0].sign(tmpFormula.messageHash).signature
            ]
        })

        const blockNumberPre = await prerequisities.eth.getBlockNumber()
        const response = await formulasContract.methods.executeFormula(formula.compile()).send({from: formulasDeployer, ...tmpGas}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)

        const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter, true)
        const expectedResult = {
            ...emptyAnalysis,
            alreadyExecuted: analysis.alreadyExecuted, // skip alreadyExecuted
            totals: {
                errors: 1,
                warnings: 0
            }
        }

        assert.deepEqual(analysis, expectedResult)

        const block = await prerequisities.eth.getBlock(blockNumberPre + 1)
        assert.isOk(analysis.alreadyExecuted)
        assert.equal(analysis.alreadyExecuted.timestamp, block.timestamp)
        assert.equal(analysis.alreadyExecuted.number, block.number)
    })


    it('complex formula', async () => {
        const amountEth = 4500
        const amountTokenErc20 = 3000
        const tokenId = 1

        const accounts = [Account.create(), Account.create()]
        const feePerOperation = await formulasContract.methods.feePerOperation().call()
        const operationCount = 5
        const fee = feePerOperation * operationCount


        /////////////////// prepare everything /////////////////////////////////
        // 1st operation
        await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amountEth * 2 + fee + 10 * tmpGas.gas * tmpGas.gasPrice)

        // 3rd operation
        // topup ether to account for transaction fees
        await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[1].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
        // approve allowance for Crypto Formulas contract
        const tx1 = await tokenErc20Contract.methods.approve(formulasContract.address, amountTokenErc20)
        await accounts[1].sendTransaction({to: tokenErc20Contract.address, data: tx1.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()
        // give tokens to account
        await tokenErc20Contract.methods.transfer(accounts[1].address, amountTokenErc20).send({from: tokenErc20Deployer, ...tmpGas})

        // 4th operation
        // topup ether to account for transaction fees
        await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[1].address, value: 10 * tmpGas.gas * tmpGas.gasPrice})
        // give tokens to account
        await tokenErc721Contract.methods.transferFrom(tokenErc721Deployer, accounts[1].address, tokenId).send({from: tokenErc721Deployer, ...tmpGas})
        // approve allowance for Crypto Formulas contract
        const tx2 = await tokenErc721Contract.methods.approve(formulasContract.address, tokenId)
        await accounts[1].sendTransaction({to: tokenErc721Contract.address, data: tx2.encodeABI(), ...tmpGas}, prerequisities.eth).getReceipt()
        /////////////////// end of preparation /////////////////////////////////


        const formulaData = {
            endpoints: [accounts[0].address, accounts[1].address],
            operations: [
                {
                    instruction: 0,
                    operands: [0, 1, amountEth]
                }, {
                    instruction: 3,
                    operands: [0, 1, amountEth]
                }, {
                    instruction: 4,
                    operands: [0, fee]
                }, {
                    instruction: 1,
                    operands: [1, 0, amountTokenErc20, tokenErc20Contract.address]
                }, {
                    instruction: 2,
                    operands: [1, 0, tokenId, tokenErc721Contract.address]
                },
            ]
        }

        const formula = new Formula(formulaData)

        const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

        assert.isFalse(analysis.feeMissing)
        assert.isFalse(analysis.feeIsLow)

        assert.equal(analysis.operations.length, operationCount)
        analysis.operations.forEach((item, index) => {
            assert.equal(item.length, 0)
        })

        assert.isNull(analysis.alreadyExecuted)
    })

    describe('Overspending', () => {
        it('starting amount used twice detected', async () => {
            const feePerOperation = await formulasContract.methods.feePerOperation().call()
            const operationCount = 2
            const fee = feePerOperation * operationCount

            const amount = fee + 4500 // ensure amount is bigger than fee

            const accounts = [Account.create(), Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address],
                operations: [
                    {
                        instruction: 3,
                        operands: [0, 1, amount]
                    }, {
                        instruction: 4,
                        operands: [0, fee]
                    }
                ]
            }

            // topup only `amount` of ether - not including fee
            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount + fee)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedStarting = {
                etherInternal: {
                    0: bigNumberify(amount)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedMissing = {
                etherInternal: {
                    0: bigNumberify(fee)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedBalances = {
                starting: expectedStarting,
                neededExtremes: expectedExtremes,
                missing: expectedMissing
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)

            assert.equal(analysis.totals.warnings, 1)
            assert.equal(analysis.operations[0].length, 0)
            assert.equal(analysis.operations[1].length, 0)
        })

        it('multiple parties overspending - all detected', async () => {
            const feePerOperation = await formulasContract.methods.feePerOperation().call()
            const operationCount = 4
            const fee = feePerOperation * operationCount

            const amount = fee + 4500 // ensure amount is bigger than fee

            const accounts = [Account.create(), Account.create(), Account.create()]
            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address, accounts[2].address],
                operations: [
                    {
                        instruction: 3,
                        operands: [0, 2, amount]
                    }, {
                        instruction: 3,
                        operands: [1, 2, amount]
                    }, {
                        instruction: 3,
                        operands: [1, 2, amount]
                    }, {
                        instruction: 4,
                        operands: [0, fee]
                    }
                ]
            }

            // topup only `amount` of ether - not including fee
            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)
            // topup only `amount` of ether - not including second send by party number 2
            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[1], amount)

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            const expectedExtremes = {
                etherInternal: {
                    0: bigNumberify(amount + fee),
                    1: bigNumberify(amount * 2)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedStarting = {
                etherInternal: {
                    0: bigNumberify(amount),
                    1: bigNumberify(amount)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedMissing = {
                etherInternal: {
                    0: bigNumberify(fee),
                    1: bigNumberify(amount)
                },
                etherExternal: {},
                erc20Balance: {},
                erc721Balance: {},
                erc20Allowance: {},
                erc721Allowance: {},
            }
            const expectedBalances = {
                starting: expectedStarting,
                neededExtremes: expectedExtremes,
                missing: expectedMissing
            }
            assert.deepEqual(analysis.assetsBalances, expectedBalances)

            assert.equal(analysis.totals.warnings, 2)
            analysis.operations.forEach(item => assert.equal(item.length, 0))
        })
    })

    describe('Presignatures', () => {
        it('no forbidden marks by default', async () => {
            const amount = 4500
            const accounts = [Account.create(), Account.create(), Account.create()]

            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formulaData = {
                endpoints: [accounts[0].address, accounts[1].address, accounts[2].address],
                signedEndpointCount: 3,
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 2, amount]
                    }, {
                        instruction: 0,
                        operands: [1, 2, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.presignes.length, formulaData.endpoints.length)
            analysis.presignes.forEach(item => {
                assert.equal(item, PresignStates.defaultValue)
            })
        })

        it('forbidden presigns are recognized', async () => {
            const amount = 4500
            const accounts = [Account.create(), Account.create(), Account.create()]

            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formulaData = {
                endpoints: accounts.map(item => item.address),
                signedEndpointCount: 3,
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 2, amount]
                    }, {
                        instruction: 0,
                        operands: [1, 2, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)


            const forbidenIndeces = [0, 2]

            await Promise.all(forbidenIndeces.map(async (forbiddenIndex) => {
                // topup ether for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[forbiddenIndex].address, value: 10 ** 13}).getReceipt()
                assert.isOk(await prerequisities.eth.getBalance(accounts[forbiddenIndex].address))

                // forbid the signature
                const permitTx = await formulasContract.methods.presignFormula(formula.messageHash, PresignStates.forbidden).encodeABI()
                const permitResponse = await accounts[forbiddenIndex].sendTransaction({data: permitTx, to: formulasContract.address, ...tmpGas}, prerequisities.eth).getReceipt()
                assert.isFalse(permitResponse instanceof Error)
                assert.equal(await formulasContract.methods.presignedFormulas(accounts[forbiddenIndex].address, formula.messageHash).call(), PresignStates.forbidden)
            }))

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.presignes.length, formula.endpoints.length)
            analysis.presignes.forEach((item, index) => {
                assert.equal(item, forbidenIndeces.includes(index) ? PresignStates.forbidden : PresignStates.defaultValue)
            })
        })

        it('permitted presigns are recognized', async () => {
            const amount = 4500
            const accounts = [Account.create(), Account.create(), Account.create()]

            await topupEther(prerequisities.eth, formulasContract, formulasDeployer, accounts[0], amount)

            const formulaData = {
                endpoints: accounts.map(item => item.address),
                signedEndpointCount: 3,
                operations: [
                    {
                        instruction: 0,
                        operands: [0, 2, amount]
                    }, {
                        instruction: 0,
                        operands: [1, 2, amount]
                    }
                ]
            }

            const formula = new Formula(formulaData)


            const permittedIndeces = [0, 2]

            await Promise.all(permittedIndeces.map(async (permittedIndex) => {
                // topup ether for transaction fees
                await prerequisities.eth.sendTransaction({from: formulasDeployer, to: accounts[permittedIndex].address, value: 10 ** 13}).getReceipt()
                assert.isOk(await prerequisities.eth.getBalance(accounts[permittedIndex].address))

                // forbid the signature
                const permitTx = await formulasContract.methods.presignFormula(formula.messageHash, PresignStates.permitted).encodeABI()
                const permitResponse = await accounts[permittedIndex].sendTransaction({data: permitTx, to: formulasContract.address, ...tmpGas}, prerequisities.eth).getReceipt()
                assert.isFalse(permitResponse instanceof Error)
                assert.equal(await formulasContract.methods.presignedFormulas(accounts[permittedIndex].address, formula.messageHash).call(), PresignStates.permitted)
            }))

            const analysis = await analyzeFormula(prerequisities.eth, formula, formulasContract.address, abiGetter)

            assert.equal(analysis.presignes.length, formula.endpoints.length)
            analysis.presignes.forEach((item, index) => {
                assert.equal(item, permittedIndeces.includes(index) ? PresignStates.permitted : PresignStates.defaultValue)
            })
        })
    })
}
export default testFormulaAnalyzer

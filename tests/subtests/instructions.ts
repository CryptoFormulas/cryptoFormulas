import {assert} from 'chai'
import {testingTools} from 'soliditySapper'
import {IFormulaSetting, manageFormulaTest, IFormulaEnvironment, IExecutableFormula} from './formulaTest'
import {Account} from 'web3x/account'

export const testInstructions = (prerequisities: testingTools.IPrerequisities, gasLogNamespace: string) => () => {

    describe('Instruction #0: Send Ether', () => {
        it('inter contract transaction', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100

            const startingBalances = [
                {
                    ethInner: amount
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    ethInner: amount
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send ether - inner send'],
                compileOperations: async (accounts: Account[]) => [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }
                ],
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('5 operations', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100

            const startingBalances = [
                {
                    ethInner: amount * 5
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    ethInner: amount * 5
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send ether - inner send - 5 operations'],
                compileOperations: async (accounts: Account[]) => Array.from(Array(5)).map(item => {
                    return {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }
                }),
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('insufficient ether', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100
            const lowerAmount = 50
            assert.isBelow(lowerAmount, amount)

            const startingBalances = [
                {
                    ethInner: lowerAmount
                }, {
                    // nothing
                }
            ]
            const endBalances = startingBalances
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send ether - insufficient ether'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }
                ],
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor,
                expectFailure: true
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })
    })

    describe('Instruction #1: Send ERC20', () => {
        it('Formula - send ERC20', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100

            const startingBalances = [
                {
                    tokenErc20: amount
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    tokenErc20: amount
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send erc20'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => [
                    {
                        instruction: 1,
                        operands: [0, 1, amount, env.tokenErc20Contract.address]
                    }
                ],
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })
    })

    describe('Instruction #2: Send ERC721', () => {
        it('send ERC721', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const tokenId = 0

            const startingBalances = [
                {
                    tokenErc721: [tokenId]
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    tokenErc721: [tokenId]
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send erc721'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send token party1 -> party2
                            instruction: 2,
                            operands: [0, 1, tokenId, env.tokenErc721Contract.address]
                        }
                    ]
                },
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('send ERC721 -> send ERC721', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const tokenId = 0

            const startingBalances = [
                {
                    tokenErc721: [tokenId]
                }, {
                    tokenErc721ExtraAllowance: true
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    // nothing
                }, {
                    tokenErc721: [tokenId]
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send erc721 twice'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send token party1 -> party2
                            instruction: 2,
                            operands: [0, 1, tokenId, env.tokenErc721Contract.address]
                        }, { // send token party2 -> party3
                            instruction: 2,
                            operands: [1, 2, tokenId, env.tokenErc721Contract.address]
                        }
                    ]
                },
                endpointCount: 3,
                signedEndpointCount: 2,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })
    })

    describe('Instruction #3: Withdraw ether', () => {
        it('withdraw ether', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100

            const startingBalances = [
                {
                    ethInner: amount
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    eth: amount
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send ether - withdraw'],
                compileOperations: async (accounts: Account[]) => [
                    {
                        instruction: 3,
                        operands: [0, 1, amount]
                    }
                ],
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })
    })

    describe('Instruction #4: Pay fee', () => {
        it('dummy - fee is handled in separate section', () => true)
    })

    describe('Instruction #5: Time condition', () => {
        it('only selected interval is accepted', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]

            const startingBalances = [
                {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }
            ]
            let startingBlockNumber
            const executableFormula: IExecutableFormula =  {
                compileOperations: async (accounts: Account[]) => {
                    // block number needs to be read just before the batch execution
                    startingBlockNumber = startingBlockNumber || await prerequisities.servant.eth.getBlockNumber()

                    return [
                        {
                            instruction: 5,
                            operands: [startingBlockNumber + 2, startingBlockNumber + 3]
                        }
                    ]
                }
            }
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'time condition'],
                ...executableFormula,
                endpointCount: 1,
                signedEndpointCount: 1,
                fees: false,
                universalDonor,

                expectFailure: true
            }
            const extraFormulas = [
                {
                    ...executableFormula,
                    expectFailure: false
                }, {
                    ...executableFormula,
                    expectFailure: false
                }, {
                    ...executableFormula,
                    expectFailure: true
                }
            ]

            await manageFormulaTest(startingBalances, endBalances, formulaSetting, extraFormulas)
        })

        it('minimum block is optional', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]

            const startingBalances = [
                {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }
            ]
            let startingBlockNumber
            const executableFormula: IExecutableFormula =  {
                compileOperations: async (accounts: Account[]) => {
                    // block number needs to be read just before the batch execution
                    startingBlockNumber = startingBlockNumber || await prerequisities.servant.eth.getBlockNumber()

                    return [
                        {
                            instruction: 5,
                            operands: [0, startingBlockNumber + 3]
                        }
                    ]
                }
            }
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'time condition'],
                ...executableFormula,
                endpointCount: 1,
                signedEndpointCount: 1,
                fees: false,
                universalDonor,

                expectFailure: false
            }
            const extraFormulas = [
                {
                    ...executableFormula,
                    expectFailure: false
                }, {
                    ...executableFormula,
                    expectFailure: false
                }, {
                    ...executableFormula,
                    expectFailure: true
                }
            ]

            await manageFormulaTest(startingBalances, endBalances, formulaSetting, extraFormulas)
        })

        it('maximum block is optional', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]

            const startingBalances = [
                {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }
            ]
            let startingBlockNumber
            const executableFormula: IExecutableFormula =  {
                compileOperations: async (accounts: Account[]) => {
                    // block number needs to be read just before the batch execution
                    startingBlockNumber = startingBlockNumber || await prerequisities.servant.eth.getBlockNumber()

                    return [
                        {
                            instruction: 5,
                            operands: [startingBlockNumber + 2, 0]
                        }
                    ]
                }
            }
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'time condition'],
                ...executableFormula,
                endpointCount: 1,
                signedEndpointCount: 1,
                fees: false,
                universalDonor,

                expectFailure: true
            }
            const extraFormulas = [
                {
                    ...executableFormula,
                    expectFailure: false
                }, {
                    ...executableFormula,
                    expectFailure: false
                }, {
                    ...executableFormula,
                    expectFailure: false
                }
            ]

            await manageFormulaTest(startingBalances, endBalances, formulaSetting, extraFormulas)
        })
    })

    describe('Mixed instructions', () => {
        it('Exchange ether for ERC20', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amountToken = 4500
            const amountEther = 123

            const startingBalances = [
                {
                    tokenErc20: amountToken
                }, {
                    ethInner: amountEther
                }
            ]
            const endBalances = [
                {
                    ethInner: amountEther
                }, {
                    tokenErc20: amountToken
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'exchange ether for erc20'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send token party1 -> party2
                            instruction: 1,
                            operands: [0, 1, amountToken, env.tokenErc20Contract.address]
                        }, { // send ether party2 -> party1
                            instruction: 0,
                            operands: [1, 0, amountEther]
                        }
                    ]
                },
                endpointCount: 2,
                signedEndpointCount: 2,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('Exchange ether for ERC721', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const tokenId = 0
            const amountEther = 123

            const startingBalances = [
                {
                    tokenErc721: [tokenId]
                }, {
                    ethInner: amountEther
                }
            ]
            const endBalances = [
                {
                    ethInner: amountEther
                }, {
                    tokenErc721: [tokenId]
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'exchange ether for erc721'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send token party1 -> party2
                            instruction: 2,
                            operands: [0, 1, tokenId, env.tokenErc721Contract.address]
                        }, { // send ether party2 -> party1
                            instruction: 0,
                            operands: [1, 0, amountEther]
                        }
                    ]
                },
                endpointCount: 2,
                signedEndpointCount: 2,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('Exchange ether for ERC721 - multiple tokens', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const tokenSet1 = [0, 1]
            const tokenSet2 = [2]


            const startingBalances = [
                {
                    tokenErc721: tokenSet1
                }, {
                    tokenErc721: tokenSet2
                }
            ]
            const endBalances = [
                {
                    tokenErc721: tokenSet2
                }, {
                    tokenErc721: tokenSet1
                }
            ]

            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'exchange ether for erc721 - multiple tokens'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send first token party1 -> party2
                            instruction: 2,
                            operands: [0, 1, tokenSet1[0], env.tokenErc721Contract.address]
                        }, { // send second token party1 -> party2
                            instruction: 2,
                            operands: [0, 1, tokenSet1[1], env.tokenErc721Contract.address]
                        }, { // send tokens party2 -> party1
                            instruction: 2,
                            operands: [1, 0, tokenSet2[0], env.tokenErc721Contract.address]
                        }
                    ]
                },
                endpointCount: 2,
                signedEndpointCount: 2,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('Exchange ERC20 for ERC721', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 50;
            const tokenId = 0

            const startingBalances = [
                {
                    tokenErc20: amount
                }, {
                    tokenErc721: [tokenId]
                }
            ]
            const endBalances = [
                {
                    tokenErc721: [tokenId]
                }, {
                    tokenErc20: amount
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'exchange erc20 for erc721'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send first token party1 -> party2
                            instruction: 1,
                            operands: [0, 1, amount, env.tokenErc20Contract.address]
                        }, { // send second token party1 -> party2
                            instruction: 2,
                            operands: [1, 0, tokenId, env.tokenErc721Contract.address]
                        }
                    ]
                },
                endpointCount: 2,
                signedEndpointCount: 2,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('Two parties send together ether to the third party', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amountHalf = 50;
            const amount = amountHalf * 2

            const startingBalances = [
                {
                    ethInner: amountHalf
                }, {
                    ethInner: amountHalf
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    // nothing
                }, {
                    ethInner: amount
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'two parties sends ether to third one'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send first half of eth
                            instruction: 0,
                            operands: [0, 2, amountHalf]
                        }, { // send second half of eth
                            instruction: 0,
                            operands: [1, 2, amountHalf]
                        }
                    ]
                },
                endpointCount: 3,
                signedEndpointCount: 2,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('One party sends ether to multiple parties', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amountHalf = 50;
            const amount = amountHalf * 2

            const startingBalances = [
                {
                    ethInner: amount
                }, {
                    // nothing
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    ethInner: amountHalf
                }, {
                    ethInner: amountHalf
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'one party sends ether to multiple parties'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send first half of eth
                            instruction: 0,
                            operands: [0, 1, amountHalf]
                        }, { // send second half of eth
                            instruction: 0,
                            operands: [0, 2, amountHalf]
                        }
                    ]
                },
                endpointCount: 3,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })

        it('Three parties circular formula Eth -> ERC20 -> ERC721', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100
            const tokenErc20 = 123
            const tokenId = 0

            const startingBalances = [
                {
                    ethInner: amount
                }, {
                    tokenErc20: tokenErc20
                }, {
                    tokenErc721: [tokenId]
                }
            ]
            const endBalances = [
                {
                    tokenErc721: [tokenId]
                }, {
                    ethInner: amount
                }, {
                    tokenErc20: tokenErc20
                }
            ]
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'circular formula Eth -> ERC20 -> ERC721'],
                compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                    return [
                        { // send first half of eth
                            instruction: 0,
                            operands: [0, 1, amount]
                        }, { // send second half of eth
                            instruction: 1,
                            operands: [1, 2, tokenErc20, env.tokenErc20Contract.address]
                        }, { // send second half of eth
                            instruction: 2,
                            operands: [2, 0, tokenId, env.tokenErc721Contract.address]
                        }
                    ]
                },
                endpointCount: 3,
                signedEndpointCount: 3,
                fees: false,
                universalDonor
            }

            await manageFormulaTest(startingBalances, endBalances, formulaSetting)
        })
    })
}

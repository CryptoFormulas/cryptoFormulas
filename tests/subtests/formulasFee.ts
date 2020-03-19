import {Account} from 'web3x/account'
import {testingTools} from 'soliditySapper'
import {IFormulaSetting, manageFormulaTest, deployFormulas} from './formulaTest'
import {bigNumberify} from 'web3x/ethers/bignumber'

const gasLogNamespace = 'FormulasFee'

const testFormulasFee = (prerequisities: testingTools.IPrerequisities) => () => {
    it('fee is required', async () => {
        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const amount = bigNumberify(100)

        const startingBalances = [
            {
                ethInner: amount
            }, {
                // nothing
            }
        ]
        const endBalances = startingBalances
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, 'missing fee'],
            compileOperations: async (accounts: Account[]) => [
                {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ],
            endpointCount: 2,
            signedEndpointCount: 1,
            fees: true,
            universalDonor,
            expectFailure: true
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)
    })

    it('sufficient amount is accepted', async () => {
        const {contract: tmpContract} = await deployFormulas(prerequisities, true)
        const formulaFee = bigNumberify(await tmpContract.methods.feePerOperation().call())

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const operationCount = bigNumberify(5)
        const amount = bigNumberify(100)

        const startingBalances = [
            {
                ethInner: amount.mul(operationCount.sub(1)).add(formulaFee.mul(operationCount))
            }, {
                // nothing
            }
        ]
        const endBalances = [
            {
                // nothing
            }, {
                ethInner: amount.mul(operationCount.sub(1))
            }
        ]
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, '4 operations plus fee'],
            compileOperations: async (accounts: Account[]) => [
                {
                    instruction: 4,
                    operands: [0, formulaFee.mul(operationCount)]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ],
            endpointCount: 2,
            signedEndpointCount: 1,
            fees: true,
            universalDonor
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)
    })

    it('anyone can pay the fee', async () => {
        const {contract: tmpContract} = await deployFormulas(prerequisities, true)
        const formulaFee = bigNumberify(await tmpContract.methods.feePerOperation().call())

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const operationCount = bigNumberify(1)

        const startingBalances = [
            {
                // nothing
            }, {
                ethInner: formulaFee.mul(operationCount)
            }
        ]
        const endBalances = [
            {
                // nothing
            }, {
                // nothing
            }
        ]
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, 'paid by second part'],
            compileOperations: async (accounts: Account[]) => [
                {
                    instruction: 4,
                    operands: [1, formulaFee.mul(operationCount)]
                }
            ],
            endpointCount: 2,
            signedEndpointCount: 2,
            fees: true,
            universalDonor
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)

    })

    it('insufficient amount is rejected', async () => {
        const {contract: tmpContract} = await deployFormulas(prerequisities, true)
        const formulaFee = bigNumberify(await tmpContract.methods.feePerOperation().call())

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const operationCount = bigNumberify(5)
        const amount = bigNumberify(100)

        const startingBalances = [
            {
                ethInner: amount.mul(operationCount.sub(1)).add(formulaFee.mul(operationCount))
            }, {
                // nothing
            }
        ]
        const endBalances = startingBalances
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, '4 operations plus fee - rejected'],
            compileOperations: async (accounts: Account[]) => [
                {
                    instruction: 4,
                    operands: [0, formulaFee.mul(operationCount).sub(1)]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ],
            endpointCount: 2,
            signedEndpointCount: 1,
            universalDonor,
            fees: true,
            expectFailure: true
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)
    })

    it('higher fee is accepted as donation', async () => {
        const {contract: tmpContract} = await deployFormulas(prerequisities, true)
        const formulaFee = bigNumberify(await tmpContract.methods.feePerOperation().call())
        const doubleformulaFee = formulaFee.mul(2)

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const operationCount = bigNumberify(5)
        const amount = bigNumberify(100)

        const startingBalances = [
            {
                ethInner: amount.mul(operationCount.sub(1)).add(doubleformulaFee.mul(operationCount))
            }, {
                // nothing
            }
        ]
        const endBalances = [
            {
                // nothing
            }, {
                ethInner: amount.mul(operationCount.sub(1))
            }
        ]
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, '4 operations plus fee'],
            compileOperations: async (accounts: Account[]) => [
                {
                    instruction: 4,
                    operands: [0, doubleformulaFee.mul(operationCount)]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }, {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ],
            endpointCount: 2,
            signedEndpointCount: 1,
            fees: true,
            universalDonor
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)
    })

    // in this scenario user with balance of only half fee required gets second half
    // second user and then pays the fee
    it('fee can be splitted between parties', async () => {
        const {contract: tmpContract} = await deployFormulas(prerequisities, true)
        const formulaFee = bigNumberify(await tmpContract.methods.feePerOperation().call())

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const operationCount = bigNumberify(5)
        const amount = bigNumberify(100)
        const totalFee = formulaFee.mul(operationCount)

        const startingBalances = [
            {
                ethInner: totalFee.div(2)
            }, {
                ethInner: totalFee.div(2)
            }, {
                ethInner: amount
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
                // nothing
            }, {
                ethInner: amount
            }
        ]
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, 'cooperative fee payment'],
            compileOperations: async (accounts: Account[]) => [
                {
                    instruction: 0,
                    operands: [1, 0, totalFee.div(2)]
                }, {
                    instruction: 4,
                    operands: [0, totalFee]
                }, {
                    instruction: 0,
                    operands: [2, 3, amount]
                }
            ],
            endpointCount: 4,
            signedEndpointCount: 3,
            fees: true,
            universalDonor
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)
    })
}
export default testFormulasFee

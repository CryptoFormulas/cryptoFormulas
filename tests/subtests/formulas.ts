import {assert} from 'chai'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'
import {Contract} from 'web3x/contract'
import {testFormulaValidation, prepareSignedFormula} from '../shared/formulaValidation'
import {testingTools} from 'soliditySapper'
import {IFormulaSetting, manageFormulaTest, deployFormulas, IFormulaEnvironment, IExecutableFormula} from './formulaTest'
import {Formula} from '../../src/formula/Formula'
import {bigNumberify} from 'web3x/ethers/bignumber'
import {testInstructions} from './instructions'
import {PresignStates} from '../../src/formula/analysis'


const gasLogNamespace = 'Formulas'

/**
    Top ups ether to Crypto Formulas contract on behalf of given account.
*/
const topupInnerEth = async (prerequisities: testingTools.IPrerequisities, donor: Address, contract: Contract<void>, account: Account) => {
    const tmpGas = {gas: 1000000, gasPrice: 2000}

    await prerequisities.eth.sendTransaction({from: donor, to: account.address, value: 10 ** 13}).getReceipt()
    assert.isOk(await prerequisities.eth.getBalance(account.address))

    // send funds to contract
    const tx = contract.methods.topUpEther()
    await account.sendTransaction({to: contract.address, value: bigNumberify(10 ** 13).div(2).toString(), data: tx.encodeABI(), ...tmpGas}, prerequisities.servant.eth).getReceipt()
}

const testFormulas = (prerequisities: testingTools.IPrerequisities) => () => {
    it('can be deployed', async () => {
        await deployFormulas(prerequisities, true)
    })

    describe('Validation', testFormulaValidation(prerequisities, deployFormulas, gasLogNamespace))

    it('Ether can be topped-up', async () => {
        const {contract, deployer} = await deployFormulas(prerequisities, true)
        const amount = 100

        const balance1 = await contract.methods.etherBalances(deployer).call()
        assert.equal(balance1, 0)

        const response = await contract.methods.topUpEther().send({from: deployer, value: amount}).getReceipt()
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'topup ether', response.transactionHash)

        const balance2 = await contract.methods.etherBalances(deployer).call()
        assert.equal(balance2, amount)
    })

    it('Ether can be topped-up during relay', async () => {
        const {contract, deployer} = await deployFormulas(prerequisities, false)
        const amount = 100

        const balance1 = await contract.methods.etherBalances(deployer).call()
        assert.equal(balance1, 0)

        const accounts = [Account.create()]
        const unsignedFormula = new Formula({
            endpoints: [deployer, accounts[0].address],
            signedEndpointCount: 1,
            operations: [
                {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ]
        })
        const signedFormula = new Formula({
            ...unsignedFormula,
            signatures: [
                await prerequisities.eth.sign(deployer, unsignedFormula.messageHash)
            ]
        })

        const txParams = {
            from: deployer,
            value: amount
        }

        const method = await contract.methods.executeFormula(signedFormula.compile())
        const estimatedGas = await method.estimateGas(txParams)
        const response = await method.send({...txParams, gas: estimatedGas}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)

        const balance2 = await contract.methods.etherBalances(deployer).call()
        assert.equal(balance2, 0)
        const balance3 = await contract.methods.etherBalances(accounts[0].address).call()
        assert.equal(balance3, amount)
    })

    it('Sender is auto signed when signature is missing', async () => {
        const {contract, deployer} = await deployFormulas(prerequisities, false)
        const amount = 100

        const balance1 = await contract.methods.etherBalances(deployer).call()
        assert.equal(balance1, 0)

        const accounts = [Account.create(), Account.create()]
        const formula = new Formula({
            endpoints: accounts.map(item => item.address),
            signedEndpointCount: 1,
            operations: [
                {
                    instruction: 0,
                    operands: [0, 1, amount]
                }
            ]
        })

        const txParams = {
            gas: 1000000,
            gasPrice: 2000
        }

        await topupInnerEth(prerequisities, deployer, contract, accounts[0])

        const method = await contract.methods.executeFormula(formula.compile())

        const finalParams = {
            ...txParams,
            to: contract.address,
            data: method.encodeABI()
        }

        const response = await accounts[0].sendTransaction(finalParams, prerequisities.eth).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
    })

    it('forbids sending value from unsigned endpoint', async () => {
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
                ethInner: amount
            }, {
                // nothing
            }
        ]
        const formulaSetting: IFormulaSetting = {
            prerequisities,
            gasLogName: [gasLogNamespace, 'two parties sends ether to third one'],
            compileOperations: async (accounts: Account[], env: IFormulaEnvironment) => {
                return [
                    { // send first half of eth
                        instruction: 0,
                        operands: [1, 0, amount]
                    }
                ]
            },
            endpointCount: 2,
            signedEndpointCount: 1,
            fees: false,
            universalDonor,
            expectFailure: true
        }

        await manageFormulaTest(startingBalances, endBalances, formulaSetting)
    })

    it('accepts combination of signatures and presignatures', async () => {
        const {contract, deployer: universalDonor} = await deployFormulas(prerequisities, false)
        const amount = 100

        const account1 = Account.create()
        const account2 = Account.create()
        const account3 = Account.create()
        const account4 = Account.create()

        const operations = [
            {
                instruction: 0,
                operands: [0, 3, amount]
            }, {
                instruction: 0,
                operands: [1, 3, amount]
            }, {
                instruction: 0,
                operands: [2, 3, amount]
            }
        ]

        const endpoints = [account1, account2, account3, account4]
        const tmpFormula = await prepareSignedFormula(contract, operations, endpoints, 3)



        const preparePermit = async (account: Account) => {
            const tmpGas = {gas: 1000000, gasPrice: 2000}

            await topupInnerEth(prerequisities, universalDonor, contract, account)

            const permitTx = await contract.methods.presignFormula(tmpFormula.messageHash, PresignStates.permitted).encodeABI()
            const permitResponse = await account.sendTransaction({data: permitTx, to: contract.address, ...tmpGas}, prerequisities.eth).getReceipt()

            assert.isFalse(permitResponse instanceof Error)
            assert.equal(await contract.methods.presignedFormulas(account.address, tmpFormula.messageHash).call(), PresignStates.permitted)
        }

        await preparePermit(account1)
        await topupInnerEth(prerequisities, universalDonor, contract, account2) // only topup - no presignature
        await preparePermit(account3)

        const formula = new Formula({
            ...tmpFormula,
            signatures: [
                null,
                (await account2.sign(tmpFormula.messageHash)).signature,
                null
            ]
        })

        const compiledFormula = formula.compile()
        const response = await contract.methods.executeFormula(compiledFormula).send({from: universalDonor, gas: 500000}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)

        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'mixed signatures/presignatures', response.transactionHash)
    })

    describe('Repeated relay', () => {
        it('is rejected', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100

            const startingBalances = [
                {
                    ethInner: amount * 2
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    ethInner: amount
                }, {
                    ethInner: amount
                }
            ]
            const tmpFormula = new Formula() // created just for salt generation
            const executableFormula: IExecutableFormula =  {
                compileOperations: async (accounts: Account[]) => [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }
                ],
                salt: tmpFormula.salt
            }
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send ether'],
                ...executableFormula,
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }
            const extraFormulas = [
                {
                    ...executableFormula,
                    expectFailure: true
                }
            ]

            await manageFormulaTest(startingBalances, endBalances, formulaSetting, extraFormulas)
        })

        it('is accepted when salt is different', async () => {
            const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
            const amount = 100

            const startingBalances = [
                {
                    ethInner: amount * 2
                }, {
                    // nothing
                }
            ]
            const endBalances = [
                {
                    // nothing
                }, {
                    ethInner: amount * 2
                }
            ]
            const executableFormula: IExecutableFormula =  {
                compileOperations: async (accounts: Account[]) => [
                    {
                        instruction: 0,
                        operands: [0, 1, amount]
                    }
                ],
            }
            const formulaSetting: IFormulaSetting = {
                prerequisities,
                gasLogName: [gasLogNamespace, 'send ether'],
                ...executableFormula,
                endpointCount: 2,
                signedEndpointCount: 1,
                fees: false,
                universalDonor
            }
            const extraFormulas = [
                {
                    ...executableFormula
                }
            ]

            await manageFormulaTest(startingBalances, endBalances, formulaSetting, extraFormulas)
        })
    })

    testInstructions(prerequisities, gasLogNamespace)()
}
export default testFormulas

import {assert} from 'chai'
import {testingTools} from 'soliditySapper'
import {Contract} from 'web3x/contract'
import {Account} from 'web3x/account'
import {IOperationData, IFormula} from '../../src/formula/IFormula'
import {Formula} from '../../src/formula/Formula'
import {PresignStates} from '../../src/formula/analysis'
import {BigNumber} from 'web3x/ethers/bignumber'
import {signFormulaEndpoint} from './signFormula'


export type IEndpointTesting = Account

export async function prepareSignedFormula(contract: Contract, operations: IOperationData[], endpoints: IEndpointTesting[], signedEndpointCount: number, salt?: BigNumber): Promise<IFormula> {
    const tmpEndpoints = endpoints.map(item => item.address)
    const rawFormula = new Formula({
        ...(salt ? {salt} : {}),
        signedEndpointCount,
        endpoints: tmpEndpoints,
        operations
    })

    const signatures = await Promise.all(endpoints.slice(0, signedEndpointCount).map((item, index) => signFormulaEndpoint(rawFormula, item, index)))

    const formula = new Formula({
        ...rawFormula,
        signatures: signatures.map(item => item.signature)
    })

    return formula
}

export const testFormulaValidation = (prerequisities: testingTools.IPrerequisities, deploy: Function, gasLogNamespace: string) => () => {
    it('valid signature is accepted', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const account = Account.create()
        const amount = 100000
        const operations = [
            {
                instruction: 0,
                operands: [0, 0, amount]
            }
        ]

        const endpoints = [account]
        const formula = await prepareSignedFormula(contract, operations, endpoints, 1)
        const compiledFormula = formula.compile()

        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)

        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()
        assert.isTrue(callResult)
    })

    it('invalid signature is rejected', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100000

        const account1 = Account.create()

        const operations = [
            {
                instruction: 0,
                operands: [0, 0, amount]
            }
        ]
        const endpoints = [account1]
        const tmpFormula = await prepareSignedFormula(contract, operations, endpoints, 1)

        const formula = new Formula({
            ...tmpFormula,
            signatures: ['0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000']
        })
        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula - invalid', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()
        assert.isFalse(callResult)
    })

    it('missing signature is rejected', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100000

        const account1 = Account.create()
        const account2 = Account.create()
        const account3 = Account.create()

        assert.notEqual(account1.address.toString(), account2.address.toString())

        const operations = [
            {
                instruction: 0,
                operands: [0, 1, amount]
            }, {
                instruction: 0,
                operands: [1, 2, amount]
            },
        ]
        const endpoints = [account1, account2, account3]
        const tmpFormula = await prepareSignedFormula(contract, operations, endpoints, 2)

        const formula = new Formula({
            ...tmpFormula,
            signatures: tmpFormula.signatures.slice(0, 1) // keep only the first signature
        })

        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula - invalid', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()
        assert.isFalse(callResult)
    })

    it('requires signatures from signing endpoints only', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100000

        const account1 = Account.create()
        const account2 = Account.create()
        const account3 = Account.create()

        const operations = [
            {
                instruction: 0,
                operands: [0, 1, amount]
            }, {
                instruction: 0,
                operands: [1, 2, amount]
            },
        ]
        const endpoints = [account1, account2, account3]
        const formula = await prepareSignedFormula(contract, operations, endpoints, 2)

        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()

        assert.isTrue(callResult)
    })

    it('presignatures don\'t exist by default', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100

        const account1 = Account.create()
        const account2 = Account.create()

        const operations = [
            {
                instruction: 0,
                operands: [0, 1, amount]
            }
        ]

        const endpoints = [account1, account2]
        const tmpFormula = await prepareSignedFormula(contract, operations, endpoints, 1)
        const formula = new Formula({
            ...tmpFormula,
            signatures: [] // clear all signatures
        })

        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        assert.equal(await contract.methods.presignedFormulas(account1.address, formula.messageHash).call(), PresignStates.defaultValue)

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula - invalid', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()
        assert.isFalse(callResult)
    })

    it('permits formula with presignature', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100
        const tmpGas = {gas: 1000000, gasPrice: 2000}

        const account1 = Account.create()
        const account2 = Account.create()

        await prerequisities.eth.sendTransaction({from: universalDonor, to: account1.address, value: 10 ** 13}).getReceipt()
        assert.isOk(await prerequisities.eth.getBalance(account1.address))

        const operations = [
            {
                instruction: 0,
                operands: [0, 1, amount]
            }
        ]

        const endpoints = [account1, account2]
        const tmpFormula = await prepareSignedFormula(contract, operations, endpoints, 1)


        const permitTx = await contract.methods.presignFormula(tmpFormula.messageHash, PresignStates.permitted).encodeABI()
        const permitResponse = await account1.sendTransaction({data: permitTx, to: contract.address, ...tmpGas}, prerequisities.eth).getReceipt()
        assert.isFalse(permitResponse instanceof Error)
        assert.equal(await contract.methods.presignedFormulas(account1.address, tmpFormula.messageHash).call(), PresignStates.permitted)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'presignFormula', permitResponse.transactionHash)

        const formula = new Formula({
            ...tmpFormula,
            signatures: [] // clear all signatures
        })

        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()
        assert.isTrue(callResult)
    })

    it('rejects revoked presignature', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100
        const tmpGas = {gas: 1000000, gasPrice: 2000}

        const account1 = Account.create()
        const account2 = Account.create()

        await prerequisities.eth.sendTransaction({from: universalDonor, to: account1.address, value: 10 ** 13}).getReceipt()
        assert.isOk(await prerequisities.eth.getBalance(account1.address))

        const operations = [
            {
                instruction: 0,
                operands: [0, 1, amount]
            }
        ]

        const endpoints = [account1, account2]
        const tmpFormula = await prepareSignedFormula(contract, operations, endpoints, 1)

        const permitTx = await contract.methods.presignFormula(tmpFormula.messageHash, PresignStates.permitted).encodeABI()
        const permitResponse = await account1.sendTransaction({data: permitTx, to: contract.address, ...tmpGas}, prerequisities.eth).getReceipt()
        assert.isFalse(permitResponse instanceof Error)
        assert.equal(await contract.methods.presignedFormulas(account1.address, tmpFormula.messageHash).call(), PresignStates.permitted)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'presignFormula', permitResponse.transactionHash)

        const forbidTx = await contract.methods.presignFormula(tmpFormula.messageHash, PresignStates.defaultValue).encodeABI()
        const forbidResponse = await account1.sendTransaction({data: forbidTx, to: contract.address, ...tmpGas}, prerequisities.eth).getReceipt()
        assert.isFalse(permitResponse instanceof Error)
        assert.equal(await contract.methods.presignedFormulas(account1.address, tmpFormula.messageHash).call(), PresignStates.defaultValue)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'forbidFormula', forbidResponse.transactionHash)

        const formula = new Formula({
            ...tmpFormula,
            signatures: [] // clear all signatures
        })

        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
        assert.isFalse(response instanceof Error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula - invalid', response.transactionHash)

        const callResult = await contract.methods.validateFormula(contractFormula).call()
        assert.isFalse(callResult)
    })

    it('rejects formula with forbidden signature', async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const amount = 100
        const tmpGas = {gas: 1000000, gasPrice: 2000}

        const account1 = Account.create()
        const account2 = Account.create()

        await prerequisities.eth.sendTransaction({from: universalDonor, to: account1.address, value: 10 ** 13}).getReceipt()
        assert.isOk(await prerequisities.eth.getBalance(account1.address))

        const operations = [
            {
                instruction: 0,
                operands: [0, 1, amount]
            }
        ]

        // create formula
        const endpoints = [account1, account2]
        const formula = await prepareSignedFormula(contract, operations, endpoints, 1) // keep signatures

        const compiledFormula = formula.compile()
        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

        // ensure formula is valid and would be executed if no signature is forbidden
        const isValidBefore = await contract.methods.validateFormula(contractFormula).call()
        assert.isTrue(isValidBefore)

        // forbid the signature
        const permitTx = await contract.methods.presignFormula(formula.messageHash, PresignStates.forbidden).encodeABI()
        const permitResponse = await account1.sendTransaction({data: permitTx, to: contract.address, ...tmpGas}, prerequisities.eth).getReceipt()
        assert.isFalse(permitResponse instanceof Error)
        assert.equal(await contract.methods.presignedFormulas(account1.address, formula.messageHash).call(), PresignStates.forbidden)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'presignFormula', permitResponse.transactionHash)

        // check that formula is invalid now
        const isValidAfter = await contract.methods.validateFormula(contractFormula).call()
        assert.isTrue(isValidAfter)
    })

    it(`endpoints and signatures can't be swapped`, async () => {
        const {contract, deployer: universalDonor} = await deploy(prerequisities)
        const accounts = [Account.create(), Account.create()]
        const amount = 100000
        const operations = [
            {
                instruction: 0,
                operands: [0, 0, amount]
            }
        ]

        const endpoints = accounts
        const formula = await prepareSignedFormula(contract, operations, endpoints, 2)

        const formulaSwappedEndpoints = new Formula({
            ...formula,
            endpoints: [formula.endpoints[1], formula.endpoints[0]],
            signatures: [formula.signatures[1], formula.signatures[0]],
        })

        const runValidation = async (formula) => {
            const compiledFormula = formula.compile()

            const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()

            const response = await contract.methods.validateFormula(contractFormula).send({from: universalDonor}).getReceipt().catch(error => error)
            assert.isFalse(response instanceof Error)

            await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'validateFormula', response.transactionHash)

            const callResult = await contract.methods.validateFormula(contractFormula).call()

            return callResult
        }

        const callResult1 = await runValidation(formula)
        const callResult2 = await runValidation(formulaSwappedEndpoints)

        assert.isTrue(callResult1)
        assert.isFalse(callResult2)
    })
}

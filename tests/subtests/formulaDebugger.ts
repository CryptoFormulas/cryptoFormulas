import {assert} from 'chai'
import {testingTools} from 'soliditySapper'
import {AddressZero} from 'web3x/ethers/constants'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'
import {Contract} from 'web3x/contract'
import {prepareSignedFormula} from '../shared/formulaValidation'
import {deployERC20} from './formulaTest'


const gasLogNamespace = 'FormulasDebugger'

export interface IDeployedContract {
    contract: Contract
    deployer: Address
    address: Address
}

/**
    Deploy Crypto Formulas debugger contract.
*/
export async function deployFormulaDebugger(prerequisities: testingTools.IPrerequisities): Promise<IDeployedContract> {
    const contractPath = 'FormulasDebugger:FormulasDebugger'

    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const settings = {
        gas: 5000000
    }
    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractPath, deployer, [], prerequisities.libraries, settings)

    assert.notEqual(address, AddressZero)

    const contract = await prerequisities.servant.createContract(contractPath, address)

    await prerequisities.gasAnalytics.recordTransaction('FormulasDebugger', 'deploy', transactionHash)

    return {contract, deployer, address}
}

/**
    Deploy EtherFeeder contract.
*/
async function deployEtherFeeder(prerequisities: testingTools.IPrerequisities) {
    const contractPath = 'FormulasDebugger:EtherFeeder'

    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const settings = {
        gas: 3000000,
        value: 10 ** 13
    }
    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractPath, deployer, [], prerequisities.libraries, settings)

    assert.notEqual(address, AddressZero)

    const contract = await prerequisities.servant.createContract(contractPath, address)

    return {contract, deployer, address}
}

/**
    Deploy EtherMartyr contract.
*/
export async function deployEtherMartyr(prerequisities: testingTools.IPrerequisities, donee: Address, amount: number): Promise<IDeployedContract> {
    const contractPath = 'FormulasDebugger:EtherMartyr'

    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const settings = {
        //gas: 3000000
        value: amount
    }

    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractPath, deployer, [donee], prerequisities.libraries, settings)

    assert.notEqual(address, AddressZero)

    const contract = await prerequisities.servant.createContract(contractPath, address)

    return {contract, deployer, address}
}


const testFormulaValidator = (prerequisities: testingTools.IPrerequisities) => () => {
    it('can be deployed', async () => {
        await deployFormulaDebugger(prerequisities)
    })

    it('decompiles formula', async () => {
        const accounts = [Account.create(), Account.create(), Account.create()]
        const amount = 50


        const {contract: tokenContract, address: tokenAddress} = await deployERC20(prerequisities)

        const formulaData = {
            endpoints: accounts.map(item => item.address),
            operations: [
                {
                    instruction: 2,
                    operands: [0, 1, amount, tokenAddress]
                }, {
                    instruction: 2,
                    operands: [0, 2, amount, tokenAddress]
                }, {
                    instruction: 0,
                    operands: [1, 0, amount]
                }, {
                    instruction: 0,
                    operands: [1, 2, amount]
                }, {
                    instruction: 1,
                    operands: [2, 0, amount, tokenAddress]
                }, {
                    instruction: 1,
                    operands: [2, 1, amount, tokenAddress]
                }
            ]
        }

        const {contract} = await deployFormulaDebugger(prerequisities)
        const formula = await prepareSignedFormula(contract, formulaData.operations, accounts, 3)
        const compiledFormula = formula.compile()

        const tx = contract.methods.decompileFormulaCompiled(compiledFormula)
        const result = await tx.call()

        await prerequisities.gasAnalytics.recordEstimation(gasLogNamespace, 'decompile (3 endpoints, 6 transactions)', tx)


        const stripAddress = address => address.toString().replace(/^0x/, '').toLowerCase()
        const expectedResult = [
            // salt
            formula.salt.toString().replace(/^0x/, ''),

            // endpoints
            '3', // count of endpoints needed for signing
            [
                {"buffer": accounts[0].address.toBuffer()},
                {"buffer": accounts[1].address.toBuffer()},
                {"buffer": accounts[2].address.toBuffer()}
            ],
            // operations
            [
                [
                    '2',
                    '0x'
                        + '0000'
                        + '0001'
                        + '0000000000000000000000000000000000000000000000000000000000000032'
                        + stripAddress(tokenAddress)
                ], [
                    '2',
                    '0x'
                        + '0000'
                        + '0002'
                        + '0000000000000000000000000000000000000000000000000000000000000032'
                        + stripAddress(tokenAddress)
                ], [
                    '0',
                    '0x'
                        + '0001'
                        + '0000'
                        + '0000000000000000000000000000000000000000000000000000000000000032'
                ], [
                    '0',
                    '0x'
                        + '0001'
                        + '0002'
                        + '0000000000000000000000000000000000000000000000000000000000000032'
                ], [
                    '1',
                    '0x'
                        + '0002'
                        + '0000'
                        + '0000000000000000000000000000000000000000000000000000000000000032'
                        + stripAddress(tokenAddress)
                ], [
                    '1',
                    '0x'
                        + '0002'
                        + '0001'
                        + '0000000000000000000000000000000000000000000000000000000000000032'
                        + stripAddress(tokenAddress)
                ]
            ],
            // signatures
            formula.signatures.map(signature => signature.toString())
        ]

        assert.deepEqual(result, expectedResult)
    })

    it('Ether can be topped-up from another contract via .transfer()', async () => {
        const {contract: formulasContract, deployer: formulasDeployer} = await deployFormulaDebugger(prerequisities)
        const {contract: feederContract, deployer: feederDeployer} = await deployEtherFeeder(prerequisities)

        const amount = 1000;

        const balance1 = await formulasContract.methods.etherBalances(feederContract.address).call()
        assert.equal(balance1, 0)

        const response = await feederContract.methods.sendEther(amount, formulasContract.address).send({from: feederDeployer}).getReceipt()
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'topup ether from contract', response.transactionHash)

        const balance2 = await formulasContract.methods.etherBalances(feederContract.address).call()
        assert.equal(balance2, amount)
        const balance3 = await prerequisities.eth.getBalance(formulasContract.address)
        assert.equal(balance3, amount)
    })
}
export default testFormulaValidator

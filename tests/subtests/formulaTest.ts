import {assert} from 'chai'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'
import {AddressZero} from 'web3x/ethers/constants'
import {testingTools} from 'soliditySapper'
import {IOperationData} from '../../src/formula/IFormula'
import {Contract} from 'web3x/contract'
import {prepareSignedFormula} from '../shared/formulaValidation'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {topupAccounts, IBalances} from '../shared/topup'


export const formulasDeployGas = 5000000

/////////////////// Interfaces /////////////////////////////////////////////////


export interface IExecutableFormula {
    compileOperations: (accounts: Account[], env: IFormulaEnvironment) => Promise<IOperationData[]>
    expectFailure?: boolean
    salt?: BigNumber
}

export interface IFormulaSetting extends IExecutableFormula {
    prerequisities: testingTools.IPrerequisities
    //endpointIndeces: number[]
    endpointCount: number
    signedEndpointCount: number
    universalDonor: Address
    //gasLog(prerequisities, name, response): Promise<void>
    gasLogName: [string, string]
    fees: boolean
}

export interface IFormulaEnvironment extends IFormulaSetting {//, IFormulaTestVariables {
    formulasContract: Contract
    tokenErc20Contract: Contract
    tokenErc721Contract: Contract
}

/////////////////// Utils //////////////////////////////////////////////////////

/**
    Deploy Crypto Formulas contract.
*/
export async function deployFormulas(prerequisities: testingTools.IPrerequisities, fees: boolean) {
    const contractSource = fees ? 'CryptoFormulas:CryptoFormulas' : 'FormulasFeeless:FormulasFeeless'

    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const settings = {
        gas: formulasDeployGas
    }
    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractSource, deployer, [], prerequisities.libraries, settings)

    assert.notEqual(address, AddressZero)

    const contract = await prerequisities.servant.createContract(contractSource, address)

    await prerequisities.gasAnalytics.recordTransaction('Formulas', 'deploy', transactionHash)

    return {contract, deployer, address}
}

export async function deployERC20(prerequisities: testingTools.IPrerequisities) {
    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const contractPath = 'TestingTokens:TestingERC20'
    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractPath, deployer, [], prerequisities.libraries)

    const contract = await prerequisities.servant.createContract(contractPath, address)
    await prerequisities.gasAnalytics.recordTransaction('TestingERC20', 'deploy', transactionHash)

    return {contract, deployer, address}
}

export async function deployERC721(prerequisities: testingTools.IPrerequisities) {
    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const contractPath = 'TestingTokens:TestingERC721'
    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractPath, deployer, [], prerequisities.libraries)

    const contract = await prerequisities.servant.createContract(contractPath, address)
    await prerequisities.gasAnalytics.recordTransaction('TestingERC721', 'deploy', transactionHash)

    return {contract, deployer, address}
}


/////////////////// Manage Formula test ///////////////////////////////////////////
export async function manageFormulaTest(startBalances: IBalances, endBalances: IBalances, formulaSetting: IFormulaSetting, extraFormulas: IExecutableFormula[] = []) {

    if (!validateInputs(startBalances, endBalances)) {
        throw 'Invalid test setting - addresses/indeces in start/end balances don\'t match'
    }

    const accounts = await prepareAccounts(startBalances)

    const {contract} = await deployFormulas(formulaSetting.prerequisities, formulaSetting.fees)
    const {contract: tokenErc20Contract} = await deployERC20(formulaSetting.prerequisities)
    const {contract: tokenErc721Contract} = await deployERC721(formulaSetting.prerequisities)

    const env: IFormulaEnvironment = {
        ...formulaSetting,
        formulasContract: contract,
        tokenErc20Contract,
        tokenErc721Contract
    }

    await topupAccounts(accounts, startBalances, env)

    assert.isTrue(await checkBalances(accounts, startBalances, env), 'Invalid initial formula balance')
    await executeFormula(accounts, env)
    await extraFormulas.reduce(async (accPromise, item) => {
        await accPromise
        const tmpEnv = {
            ...env,
            ...item
        }

        await executeFormula(accounts, tmpEnv)
    }, Promise.resolve())
    assert.isTrue(await checkBalances(accounts, endBalances, env), 'Invalid end formula balance')
}


function validateInputs(startBalances: IBalances, endBalances: IBalances): boolean {
    const startingKeys = Object.keys(startBalances)
    const endKeys = Object.keys(endBalances)

    if (startingKeys.length != endKeys.length) {
        return false
    }

    const keysMatch = startingKeys.every((item, index) => item === endKeys[index])

    return keysMatch
}


async function prepareAccounts(balances: IBalances): Promise<Account[]> {
    return Object.keys(balances).map(item => Account.create())
}

async function checkBalances(accounts: Account[], balances: IBalances, env: IFormulaEnvironment): Promise<boolean> {
    const checkEthBalance = async (account: Account, amount: BigNumber) => {
        const balance = await env.prerequisities.eth.getBalance(account.address)

        return balance == amount.toString()
    }
    const checkEthInnerBalance = async (account: Account, amount: BigNumber) => {
        const balance = await env.formulasContract.methods.etherBalances(account.address).call()

        return balance == amount.toString()
    }
    const checkTokenErc20Balance = async (account: Account, amount: BigNumber) => {
        const balance = await env.tokenErc20Contract.methods.balanceOf(account.address).call()

        return balance == amount
    }
    const checkTokenErc721Balance = async (account: Account, tokenIds: BigNumber[]) => {
        const results = await Promise.all(tokenIds.map(async tokenId => {
            const owner = await env.tokenErc721Contract.methods.ownerOf(tokenId).call()
            return owner == account.address.toString()
        }))

        return results.reduce((acc, item) => acc && item, true)
    }

    const checkUserBalances = async (accPromise, key, index) => await accPromise
        && (typeof balances[key].eth == 'undefined' || await checkEthBalance(accounts[index], bigNumberify(balances[key].eth || 0)))
        && await checkEthInnerBalance(accounts[index], bigNumberify(balances[key].ethInner || 0))
        && await checkTokenErc20Balance(accounts[index], bigNumberify(balances[key].tokenErc20 || 0))
        && await checkTokenErc721Balance(accounts[index], (balances[key].tokenErc721 || []).map(bigNumberify))

    const result = await Object.keys(balances).reduce(checkUserBalances, Promise.resolve(true))

    return result
}

async function executeFormula(accounts: Account[], env: IFormulaEnvironment): Promise<void> {
    const endpoints = Array.from(new Array(env.endpointCount)).map((dummy: never, index: number) => accounts[index])
    const operations = await env.compileOperations(accounts, env)
    const formula = await prepareSignedFormula(env.formulasContract, operations, endpoints, env.signedEndpointCount, env.salt)
    const compiledFormula = formula.compile()

    const response = await env.formulasContract.methods.executeFormula(compiledFormula).send({from: env.universalDonor, gas: 500000}).getReceipt().catch(error => error)

    if (env.expectFailure) {
        assert.isTrue(response instanceof Error, 'Formula\'s execution successful even when expected to fail')

        await env.prerequisities.gasAnalytics.recordTransaction(env.gasLogName[0], env.gasLogName[1], response.hashes[0])
        return
    }

    assert.isFalse(response instanceof Error, 'Unexpected error occured during formula\'s execution')

    await env.prerequisities.gasAnalytics.recordTransaction(env.gasLogName[0], env.gasLogName[1], response.transactionHash)
}

import {assert} from 'chai'
import {AddressZero} from 'web3x/ethers/constants'
import {testingTools} from 'soliditySapper'


/**
    Deploy Solidity library.
*/
async function exportGenericLibrary(servant: testingTools.ContractServant, gasAnalytics: testingTools.GasAnalytics, name: string): Promise<string> {
    const deployer = (await servant.eth.getAccounts())[0]
    const {address, transactionHash} = await servant.easyDeploy(name, deployer)

    assert.notEqual(address, AddressZero)

    await gasAnalytics.recordTransaction(name.split(':')[1], 'deploy', transactionHash)

    return address.toString()
}

/**
    Deploy Open-Zeppelin's SafeMath library.
*/
export async function deploySafeMath(servant: testingTools.ContractServant, gasAnalytics: testingTools.GasAnalytics): Promise<string> {
    return await exportGenericLibrary(servant, gasAnalytics, 'CryptoFormulas:SafeMath')
}

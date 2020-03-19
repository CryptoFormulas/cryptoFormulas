import {assert} from 'chai'
import {testingTools} from 'soliditySapper'
import {AddressZero} from 'web3x/ethers/constants'
import {testFormulaValidation} from '../shared/formulaValidation'


/**
    Deploy Crypto Formulas validator contract.
*/
async function deployFormulaValidator(prerequisities: testingTools.IPrerequisities) {
    const contractSource = 'FormulasFeeless:FormulaValidatorFeeless'

    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const {address, transactionHash} = await prerequisities.servant.easyDeploy(contractSource, deployer, [], prerequisities.libraries)

    assert.notEqual(address, AddressZero)

    const contract = await prerequisities.servant.createContract(contractSource, address)

    await prerequisities.gasAnalytics.recordTransaction('FormulaValidator', 'deploy', transactionHash)

    return {contract, deployer, address}
}


const testFormulaValidator = (prerequisities: testingTools.IPrerequisities) => () => {
    it('can be deployed', async () => {
        await deployFormulaValidator(prerequisities)
    })

    testFormulaValidation(prerequisities, deployFormulaValidator, 'FormulaValidator')()
}
export default testFormulaValidator

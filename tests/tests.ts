//import ethereumSimulator, {autominingBlockTime} from './ethereumSimulator'
import {testingTools} from 'soliditySapper'
import testFormulas from './subtests/formulas'
import testFormulasFee from './subtests/formulasFee'
import testFormulaClass from './subtests/formulaClass'
import testStaticUpdate from './subtests/staticUpdate'
import testFormulaValidator from './subtests/formulaValidator'
import testFormulaDebugger from './subtests/formulaDebugger'
import testDonationWithdrawal from './subtests/donationWithdrawal'
import testFormulaAnalyzer from './subtests/formulaAnalyzer'
import {deploySafeMath} from './subtests/deployLibraries'
import * as glob from 'fast-glob'


describe('Crypto Formulas Components', () => {
    const prerequisities: testingTools.IPrerequisities = {eth: null, servant: null, libraries: {}, gasAnalytics: null}

    // before
    before(async () => {
        prerequisities.eth = await testingTools.ethereumSimulator()
        prerequisities.servant = await prepareServant(prerequisities.eth)
        prerequisities.gasAnalytics = new testingTools.GasAnalytics(prerequisities.eth)
        prerequisities.libraries = {
            'CryptoFormulas:SafeMath': await deploySafeMath(prerequisities.servant, prerequisities.gasAnalytics),
        }
    })

    // prepare new blockchain environment
    beforeEach(async () => {

    })

    afterEach(async () => {
        // TODO: restart server
    })

    after(async () => {
        console.log('')
        prerequisities.gasAnalytics.printMeasurements()
    })

    describe('FormulaClass', testFormulaClass(prerequisities))
    describe('StaticUpdate', testStaticUpdate(prerequisities))
    describe('FormulaValidator', testFormulaValidator(prerequisities))
    describe('FormulasDebugger', testFormulaDebugger(prerequisities))
    describe('Formulas', testFormulas(prerequisities))
    describe('FormulasFee', testFormulasFee(prerequisities))
    describe('DontationWithdrawal', testDonationWithdrawal(prerequisities))
    describe('FormulaAnalyzer', testFormulaAnalyzer(prerequisities))
})

async function prepareServant(eth) {
    const contractFiles = await glob([
        __dirname + '/../dist/src/contracts/*.json',
        __dirname + '/../dist/tests/contracts/*.json',
        '!' + __dirname + '/../dist/src/contracts/*_abi.json',
        '!' + __dirname + '/../dist/tests/contracts/*_abi.json',

        /* TODO: use this instead when fast-glob issue is fixed https://github.com/mrmlnc/fast-glob/issues/257
        __dirname + '/../dist/(src|tests)/contracts/*.json',
        '!' + __dirname + '/../dist/(src|tests)/contracts/*_abi.json',
        */
    ])

    const compiledContracts = contractFiles
        .map(item => item.toString())
        .map(item => require(item).contracts)
        .reduce((accumulator, item) => {
            return {
                contracts: {
                    ...accumulator.contracts,
                    ...item
                }
            }
        }, {contracts: {}})

    const servant = new testingTools.ContractServant(eth, compiledContracts, testingTools.autominingBlockTime)

    return servant
}

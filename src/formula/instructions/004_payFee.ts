import {Address} from 'web3x/address'
import {IFormula} from '../IFormula'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {IContractFactory, ErrorTypes, IAssetDiff, emptyAssetState, IAnalyzerResult, IDictionary} from '../analysis'
import {IInstructionType} from './IInstructionType'
import {ITypes, ITypeAlias} from '../format'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'
import {checkSenderEndpointEmpty, checkEtherInnerBalance} from './commonAnalysisChecks'


/**
    Instruction's custom problem reasons.
*/
export enum InstructionErrorReasons {
    feeTooLow = 'feeTooLow',
    insufficientEtherInternalForFee = 'insufficientEtherInternalForFee'
}

/**
    Instruction's combined problem reasons.
*/
export type ErrorReasons = CommonErrorReasons | InstructionErrorReasons

const instructionCode = 4

// instruction definition
const instruction: IInstructionType = {
    name: 'payFee',
    instructionCode,
    format: [
        {
            type: ITypes.signedEndpoint,
            name: 'fromEndpoint'
        }, {
            type: ITypes.uint256,
            typeAlias: ITypeAlias.etherFeeAmount,
            name: 'etherAmount'
        },
    ],
    executionAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory) => {
        const senderEndpoint = operands[0]

        const senderAddress = formula.endpoints[senderEndpoint.toNumber()]
        const amount = operands[1]

        const errorsSenderEmpty = checkSenderEndpointEmpty(instructionCode, senderEndpoint, senderAddress)

        let errorList = []
            .concat(errorsSenderEmpty)
            .concat(await checkRequiredFeeNotMatched(formula, amount, contractAddress, contractFactory))


        if (!errorsSenderEmpty.length) {
            const errorParameters = {
                senderEndpoint,
                senderAddress,
            }
            errorList = errorList.concat(await checkEtherInnerBalanceForFee(instructionCode, senderAddress, amount, contractAddress, contractFactory, errorParameters))
        }

        return errorList
    },
    valueTransferAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetDiff> => {
        const senderAddress = formula.endpoints[operands[0].toNumber()]
        const amount = operands[1]

        const result = {
            positive: {
                ...emptyAssetState
            },
            negative: {
                ...emptyAssetState,
                etherInternal: {
                    [operands[0].toNumber()]: amount
                }
            }
        }

        return result
    }
}
export default instruction

/**
    Check for possible problem - insufficient fee.
*/
async function checkRequiredFeeNotMatched(formula: IFormula, amount: BigNumber, contractAddress: Address, contractFactory: IContractFactory) {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const formulasContract = await contractFactory.getContractFormulas(contractAddress)
    const formulaFeePerOperation = bigNumberify(await formulasContract.methods.feePerOperation().call())

    const requiredFee = formulaFeePerOperation.mul(formula.operations.length)

    if (amount.gte(requiredFee)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.feeTooLow,
        errorType: ErrorTypes.error,
        errorParameters: {
            requiredFee,
            amount
        }
    }]
}

/**
    Check for possible problem - insufficient Ether balance inside the Formulas Contract to pay a fee.
*/
export async function checkEtherInnerBalanceForFee(instructionCode: number, address: Address, amount: BigNumber, contractAddress: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const tmp = await checkEtherInnerBalance(instructionCode, address, amount, contractAddress, contractFactory, errorParameters)

    if (!tmp.length) {
        return []
    }

    return [{
        ...tmp[0],
        errorReason: InstructionErrorReasons.insufficientEtherInternalForFee
    }]
}

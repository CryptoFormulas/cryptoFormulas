import {Address} from 'web3x/address'
import {IFormula} from '../IFormula'
import {BigNumber} from 'web3x/ethers/bignumber'
import {IAnalyzerResult, IContractFactory, IAssetDiff, emptyAssetState} from '../analysis'
import {IInstructionType} from './IInstructionType'
import {ITypes, ITypeAlias} from '../format'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'
import {checkSenderEndpointEmpty, checkTargetEndpointEmpty, checkSenderIsTarget, checkEtherInnerBalance, checkTargetIsContract} from './commonAnalysisChecks'


/**
    Instruction's custom problem reasons.
*/
export enum InstructionErrorReasons {

}

/**
    Instruction's combined problem reasons.
*/
export type ErrorReasons = CommonErrorReasons | InstructionErrorReasons

/**
    Ether send analyzation shared by instruction '#0 Send Ether' and '#3 Send Ether Withdraw'.
*/
export const analyzerGenericSendEther = (instructionCode: number, senderCanBeTarget: boolean) => async (formula: IFormula, operands: [BigNumber, BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory): Promise<IAnalyzerResult> => {
    const senderEndpoint = operands[0]
    const targetEndpoint = operands[1]

    const senderAddress = formula.endpoints[senderEndpoint.toNumber()]
    const targetAddress = formula.endpoints[targetEndpoint.toNumber()]
    const amount = operands[2]

    const errorsSenderEmpty = checkSenderEndpointEmpty(instructionCode, senderEndpoint, senderAddress)
    const errorsTargetEmpty = checkTargetEndpointEmpty(instructionCode, targetEndpoint, targetAddress)

    let errorList = []
        .concat(errorsSenderEmpty)
        .concat(errorsTargetEmpty)

    if (!errorsSenderEmpty.length) {
        const errorParameters = {
            senderEndpoint,
            senderAddress,
        }
        errorList = errorList.concat(await checkEtherInnerBalance(instructionCode, senderAddress, amount, contractAddress, contractFactory, errorParameters))
    }

    if (!senderCanBeTarget && !errorsSenderEmpty.length && !errorsTargetEmpty.length) {
        errorList = errorList.concat(checkSenderIsTarget(instructionCode, senderEndpoint, senderAddress, targetAddress))
    }

    if (!errorsTargetEmpty.length) {
        errorList = errorList.concat(await checkTargetIsContract(instructionCode, targetEndpoint, targetAddress, contractFactory))
    }

    return errorList
}

// instruction definition
const instruction: IInstructionType = {
    name: 'sendEther',
    instructionCode: 0,
    format: [
        {
            type: ITypes.signedEndpoint,
            name: 'fromEndpoint'
        }, {
            type: ITypes.endpoint,
            name: 'toEndpoint'
        }, {
            type: ITypes.uint256,
            typeAlias: ITypeAlias.etherAmount,
            name: 'etherAmount'
        },
    ],
    executionAnalyzer: analyzerGenericSendEther(0, false),
    valueTransferAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetDiff> => {
        const senderAddress = formula.endpoints[operands[0].toNumber()]
        const targetAddress = formula.endpoints[operands[1].toNumber()]
        const amount = operands[2]

        const result = {
            positive: {
                ...emptyAssetState,
                etherInternal: {
                    [operands[1].toNumber()]: amount
                }
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

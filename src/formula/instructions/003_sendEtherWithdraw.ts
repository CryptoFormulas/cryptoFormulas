import {Address} from 'web3x/address'
import {IFormula} from '../IFormula'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {IContractFactory, ErrorTypes, IAssetDiff, emptyAssetState} from '../analysis'
import {IInstructionType} from './IInstructionType'
import {ITypes, ITypeAlias} from '../format'
import {analyzerGenericSendEther} from './000_sendEther'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'


/**
    Instruction's custom problem reasons.
*/
export enum InstructionErrorReasons {

}

/**
    Instruction's combined problem reasons.
*/
export type ErrorReasons = CommonErrorReasons | InstructionErrorReasons

const instructionCode = 3

// instruction definition
const instruction: IInstructionType = {
    name: 'sendEtherWithdraw',
    instructionCode,
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
    executionAnalyzer: analyzerGenericSendEther(instructionCode, true),
    valueTransferAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetDiff> => {
        const amount = operands[2]

        const result = {
            positive: {
                ...emptyAssetState,
                etherExternal: {
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

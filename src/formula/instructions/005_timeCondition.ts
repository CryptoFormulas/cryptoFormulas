import {Address} from 'web3x/address'
import {BlockResponse} from 'web3x/formatters'
import {IFormula} from '../IFormula'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {IAnalyzerResult, IContractFactory, ErrorTypes, IAssetDiff, emptyAssetDiff} from '../analysis'
import {IInstructionType} from './IInstructionType'
import {ITypes, ITypeAlias} from '../format'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'


/**
    Instruction's custom problem reasons.
*/
export enum InstructionErrorReasons {
    minimumBlockHigherThanMaximum = 'minimumBlockHigherThanMaximum',
    minimumBlockNotReached = 'minimumBlockNotReached',
    maximumBlockAlreadyPassed = 'maximumBlockAlreadyPassed',
    noTimeConditionSet = 'noTimeConditionSet'
}

/**
    Instruction's combined problem reasons.
*/
export type ErrorReasons = CommonErrorReasons | InstructionErrorReasons

const instructionCode = 5

const noBlock = Symbol('noBlock')

// instruction definition
const instruction: IInstructionType = {
    name: 'timeCondition',
    instructionCode,
    format: [
        {
            type: ITypes.uint32,
            typeAlias: ITypeAlias.blockNumber,
            name: 'minimumBlock'
        }, {
            type: ITypes.uint32,
            typeAlias: ITypeAlias.blockNumber,
            name: 'maximumBlock'
        }
    ],
    executionAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory) => {
        const minimumBlock = operands[0]
        const maximumBlock = operands[1]

        const currentBlock = await getCurrentBlock(contractFactory)

        let errorList = []
            .concat(checkMinimumGreaterThanMaximum(minimumBlock, maximumBlock))
            .concat(checkMinimumInFuture(minimumBlock, currentBlock))
            .concat(checkMaximumInPast(maximumBlock, currentBlock))
            .concat(checkMinAndMaxEmpty(minimumBlock, maximumBlock))

        return errorList
    },
    valueTransferAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber], contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetDiff> => {
        return emptyAssetDiff
    }
}
export default instruction

async function getCurrentBlock(contractFactory: IContractFactory): Promise<BlockResponse<Buffer> | typeof noBlock> {
    if (!contractFactory.isWeb3Available()) {
        return noBlock
    }

    const eth = await contractFactory.loadWeb3()
    const currentBlockNumber = await eth.getBlockNumber()
    const block = await eth.getBlock(currentBlockNumber)

    return block
}

function checkMinimumGreaterThanMaximum(minimumBlock: BigNumber, maximumBlock: BigNumber): IAnalyzerResult {
    if (minimumBlock.eq(0) || maximumBlock.eq(0) || maximumBlock.gte(minimumBlock)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.minimumBlockHigherThanMaximum,
        errorType: ErrorTypes.error,
        errorParameters: {
            minimumBlock,
            maximumBlock
        }
    }]
}

function checkMinimumInFuture(minimumBlock: BigNumber, block: BlockResponse<Buffer> | typeof noBlock): IAnalyzerResult {
    if (block === noBlock) {
        return []
    }

    const currentBlockNumber = block.number

    if (minimumBlock.eq(0) || minimumBlock.lte(currentBlockNumber)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.minimumBlockNotReached,
        errorType: ErrorTypes.warning,
        errorParameters: {
            minimumBlock,
            currentBlockNumber,
            currentBlockTimestamp: block.timestamp
        }
    }]
}

function checkMaximumInPast(maximumBlock: BigNumber, block: BlockResponse<Buffer> | typeof noBlock): IAnalyzerResult {
    if (block === noBlock) {
        return []
    }

    const currentBlockNumber = block.number

    if (maximumBlock.eq(0) || maximumBlock.gte(currentBlockNumber)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.maximumBlockAlreadyPassed,
        errorType: ErrorTypes.error,
        errorParameters: {
            maximumBlock,
            currentBlockNumber,
            currentBlockTimestamp: block.timestamp
        }
    }]
}

function checkMinAndMaxEmpty(minimumBlock: BigNumber, maximumBlock: BigNumber): IAnalyzerResult {
    if (minimumBlock.gt(0) || maximumBlock.gt(0)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.noTimeConditionSet,
        errorType: ErrorTypes.warning,
        errorParameters: {
            minimumBlock,
            maximumBlock
        }
    }]
}

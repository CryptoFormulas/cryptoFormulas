import {IFormula} from '../IFormula'
import {Address} from 'web3x/address'
import {IAnalyzerResult, IAssetDiff, IContractFactory} from '../analysis'
import {ITypes, ITypeAlias} from '../format'


/**
    Formula's operation's operand interface.
*/
export interface ITypeField {
    type: ITypes
    name: string
    typeAlias?: ITypeAlias | ITypes
}

/**
    Formula's instruction interface.
*/
export interface IInstructionType {
    name: string,
    instructionCode: number
    format: ITypeField[] // operands
    // function analysing instruction state and execution ability
    executionAnalyzer: (formula: IFormula, operands: unknown[], contractAddress: Address, contractFactory: IContractFactory) => Promise<IAnalyzerResult>
    // function returning change in assets balances instruction will cause
    valueTransferAnalyzer: (formula: IFormula, operands: unknown[], contractAddress: Address, contractFactory: IContractFactory) => Promise<IAssetDiff | null>
}

export const feeInstructionCode = 4 // instruction code that pays fee for Crypto Formulas execution

export const absoluteDefaultValue = 0 // default generic value for operation's operand

// default values for specific operation's operands
export const defaultValues = {
    'address': Address.ZERO,
}

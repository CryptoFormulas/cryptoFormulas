export * from './IInstructionType'
export * from './CommonErrorReasons'

import {IInstructionType} from './IInstructionType'

import instruction_000 from './000_sendEther'
import instruction_001 from './001_sendERC20'
import instruction_002 from './002_sendERC721'
import instruction_003 from './003_sendEtherWithdraw'
import instruction_004 from './004_payFee'
import instruction_005 from './005_timeCondition'


export {InstructionErrorReasons as ErrorReasons_000} from './000_sendEther'
export {InstructionErrorReasons as ErrorReasons_001} from './001_sendERC20'
export {InstructionErrorReasons as ErrorReasons_002} from './002_sendERC721'
export {InstructionErrorReasons as ErrorReasons_003} from './003_sendEtherWithdraw'
export {InstructionErrorReasons as ErrorReasons_004} from './004_payFee'
export {InstructionErrorReasons as ErrorReasons_005} from './005_timeCondition'

// Keep the order! They must corespond to instructions codes
export const instructionTypes: IInstructionType[] = [
    instruction_000,
    instruction_001,
    instruction_002,
    instruction_003,
    instruction_004,
    instruction_005
]

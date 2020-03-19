import {Address} from 'web3x/address'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {signatureHexLength} from './format'


export const emptySignature = '0x' + '0'.repeat(signatureHexLength) // empty Ethereum signature


/////////////////// Raw Formula ///////////////////////////////////////////////////

/**
    Endpoint type that can be passed to Formula's constructor.
*/
export type IEndpointData = Address | string

/**
    Endpoint type used inside the Formula object.
*/
export type IEndpoint = Address

/**
    Operation type that can be passed to Formula's constructor.
*/
export interface IOperationData {
    instruction: number | BigNumber
    operands: unknown[]
}

/**
    Operation type used inside the Formula object.
*/
export interface IOperation extends Readonly<IOperationData> {
    instruction: BigNumber
}

/**
    Formula data type that can be passed to Formula's constructor.
*/
export interface IFormulaData {
    salt?: BigNumber | string
    signedEndpointCount?: number
    endpoints?: IEndpointData[]
    operations?: IOperationData[]

    signatures?: (string | null)[]
    messageHash?: string
}

/**
    Formula type.
*/
export interface IFormula extends Readonly<IFormulaData> {
    salt: BigNumber
    signedEndpointCount: number
    endpoints: IEndpoint[]
    operations: IOperation[]

    signatures: string[]
    messageHash: string

    compile: () => string
    cloneNew: () => IFormula
    isSigned: (endpointIndex: number) => boolean

    //static decompile(data: string): IFormula
}


/////////////////// Compiled Formula //////////////////////////////////////////////

/**
    Operation with encoded operands.
*/
export interface ICompiledOperation {
    instruction: string
    operands: string
}

/**
    Formula with operations having encoded operands.
*/
export interface ICompiledFormula {
    salt: BigNumber
    signedEndpointCount: number
    endpoints: IEndpoint[]
    operations: ICompiledOperation[]
    signatures: string[]
    messageHash: string
}


/////////////////// DummyFormula //////////////////////////////////////////////////

/**
    Dummy class that can be used when Formula is needed but not actually loaded yet and similar situations.
*/
export class DummyFormula implements IFormula {
    public salt: BigNumber
    public signedEndpointCount: number
    public endpoints: IEndpoint[]
    public operations: IOperation[]
    public signatures: string[]
    public messageHash: string

    public constructor() {
        this.salt = bigNumberify(0)
        this.signedEndpointCount = 0
        this.endpoints = []
        this.operations = []
        this.signatures = []
        this.messageHash = ''
    }

    public compile(): string {
        return ''
    }

    public cloneNew(): DummyFormula {
        return new DummyFormula()
    }

    public isSigned(endpointIndex: number): boolean {
        return false
    }
}

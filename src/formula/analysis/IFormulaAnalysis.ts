import {Eth} from 'web3x/eth'
import {BigNumber} from 'web3x/ethers/bignumber'
import {Address} from 'web3x/address'
import {Contract} from 'web3x/contract'
import {ContractEntryDefinition} from 'web3x/contract/abi/contract-abi-definition'
import {IFormula, DummyFormula} from '../IFormula'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'


export enum ErrorTypes {
    error = 'error',
    warning = 'warning'
}

/**
    Represents Formula presign state that might be set by user prior to the Formula's execution.
    PresignStates enum should correspond to Formulas's Solidity enum with the same name.
*/
export enum PresignStates {
    defaultValue,
    permitted,
    forbidden
}

/**
    Represents change in asset balances by operation.
    Positive and negative values are treated separately for easy extremes calculation.
*/
export interface IAssetDiff {
    positive: IAssetState
    negative: IAssetState
}

export interface IDictionary<T> {
    [key: string]: T
}

/**
   Operation analysis result with no problems found.
*/
export interface IAnalyzerResultError {
    instructionCode: number
    errorReason: string
    errorType: ErrorTypes
    errorParameters: IDictionary<unknown>
}

/**
   Operation analysis result.
*/
export type IAnalyzerResult = IAnalyzerResultError[]


/**
   Asset balances info.
*/
export interface IAssetBalances {
    starting: IAssetState // balance before formula execution
    neededExtremes: IAssetState // the highest needed amounts during formula execution
    missing: IAssetState // missing balance to successfull execution
}

/**
    Relevant portion of already mined block information.
*/
export interface IBlockStats {
    number: number
    timestamp: number
}

/**
    Relevant portion of already mined transaction information.
*/
export interface ITransactionStats extends IBlockStats {
    transactionHash: string
}

/**
    Result of Formula execution analysis.
*/
export interface IFormulaAnalysis {
    isComplete: boolean
    formula: IFormula // Formula that was analysed
    alreadyExecuted: ITransactionStats | null // was Formula already executed on analysed network?
    feeMissing: boolean // fee is missing in the Formula?
    feeIsLow: boolean // fee is present in the Formula but too low?
    isEmpty: boolean // Formula has no operations, thus is empty?
    operations: IAnalyzerResult[] // analysis result of Formula's operations
    totals: { // totals count of problems for each category
        errors: number
        warnings: number
    }
    presignes: PresignStates[] // presignes for participating endpoints
    assetsBalances: IAssetBalances // asset type balances overview
}



/**
    Balances of all asset types.
*/
export type IAssetState = Readonly<{
    etherExternal: {
        [endpointIndex: number]: BigNumber
    }
    etherInternal: {
        [endpointIndex: number]: BigNumber
    }
    /*
    erc20: {
        [endpointIndex: number]: {
            [tokenContractAddress: string]: BigNumber
        }
    }
    erc721: {
        [endpointIndex: number]: {
            [tokenContractAddress: string]: BigNumber[] // BigNumber represent tokenId
        }
    }
    */
    erc20Balance: {
        [endpointIndex: number]: {
            [tokenContractAddress: string]: BigNumber
        }
    }
    erc721Balance: {
        [endpointIndex: number]: {
            [tokenContractAddress: string]: BigNumber[] // BigNumber represent tokenId
        }
    }
    erc20Allowance: {
        [endpointIndex: number]: {
            [tokenContractAddress: string]: BigNumber
        }
    }
    erc721Allowance: {
        [endpointIndex: number]: {
            /*
                `typeof Infinity` is a workaround for missing TS type for JS `Infinity`.
                See https://github.com/microsoft/TypeScript/issues/32277 for more info.
            */
            [tokenContractAddress: string]: BigNumber[] | typeof Infinity // BigNumber represent tokenId
        }
    }
}>

/**
    Factory for supported types of Ethereum contracts on active Ethereum network.
*/
export interface IContractFactory {
    isWeb3Available(): boolean
    loadWeb3(): Promise<Eth>
    getContractFormulas(contractAddress: Address): Promise<Contract>
    getContractErc20(contractAddress: Address): Promise<Contract>
    getContractErc721(contractAddress: Address): Promise<Contract>
    isContract(contractAddress: Address): Promise<boolean>
    isErc20Contract(contractAddress: Address): Promise<boolean>
    isErc721Contract(contractAddress: Address): Promise<boolean>
}

/**
    Factory for relevant contract type ABI.
*/
export interface IAbiGetter {
    (name: 'formulas' | 'erc20' | 'erc721'): Promise<ContractEntryDefinition[]>
}

/////////////////// Empty analysis /////////////////////////////////////////////

export const emptyAssetState = {
    etherExternal: {},
    etherInternal: {},
    erc20Balance: {},
    erc721Balance: {},
    erc20Allowance: {},
    erc721Allowance: {},
}

export const emptyAssetDiff = {
    positive: emptyAssetState,
    negative: emptyAssetState
}

export const emptyAssetBalances = {
    starting: emptyAssetState,
    neededExtremes: emptyAssetState,
    missing: emptyAssetState
}

export const emptyAnalysis: IFormulaAnalysis = {
    isComplete: true,
    formula: new DummyFormula(),
    alreadyExecuted: null,
    feeMissing: false,
    feeIsLow: false,
    isEmpty: false,
    operations: [],
    totals: {
        errors: 0,
        warnings: 0
    },
    presignes: [],
    assetsBalances: emptyAssetBalances
}

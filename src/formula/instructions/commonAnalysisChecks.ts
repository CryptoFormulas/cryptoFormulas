import {Address} from 'web3x/address'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {IAnalyzerResult, IContractFactory, ErrorTypes, IAssetDiff, emptyAssetState, IDictionary} from '../analysis'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'


/**
    Check for possible problem - sender endpoint has empty address.
*/
export function checkSenderEndpointEmpty(instructionCode: number, senderEndpoint: BigNumber, senderAddress: Address): IAnalyzerResult {
    const errorParameters = {
        senderEndpoint
    }
    return checkEndpointEmpty(instructionCode, senderAddress, CommonErrorReasons.senderEmpty, errorParameters)
}

/**
    Check for possible problem - target endpoint has empty address.
*/
export function checkTargetEndpointEmpty(instructionCode: number, targetEndpoint: BigNumber, targetAddress: Address): IAnalyzerResult {
    const errorParameters = {
        targetEndpoint
    }
    return checkEndpointEmpty(instructionCode, targetAddress, CommonErrorReasons.targetEmpty, errorParameters)
}

/**
    Check for possible problem - token address is empty.
*/
export function checkTokenAddressEmpty(instructionCode: number, tokenAddress: Address): IAnalyzerResult {
    const errorParameters = {
        tokenAddress
    }
    return checkEndpointEmpty(instructionCode, tokenAddress, CommonErrorReasons.tokenEmpty, errorParameters)
}

/**
    Check for possible problem - sender endpoint has empty address.
*/
export function checkEndpointEmpty(instructionCode: number, address: Address, errorReason: string, errorParameters: IDictionary<unknown>): IAnalyzerResult {
    // for some Formulas address will be empty, that's why extra checking address emptiness
    // (example is empty formula constructed via `new Formula()`)
    if (!address || !address.equals(Address.ZERO)) {
        return []
    }

    return [{
        instructionCode,
        errorReason,
        errorType: ErrorTypes.error,
        errorParameters
    }]
}

/**
    Check for possible problem - sender and target are the same.
*/
export function checkSenderIsTarget(instructionCode: number, senderEndpoint: BigNumber, senderAddress: Address, targetAddress: Address): IAnalyzerResult {
    if (!senderAddress.equals(targetAddress)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: CommonErrorReasons.senderIsTarget,
        errorType: ErrorTypes.warning,
        errorParameters: {
            senderAddress,
            senderEndpoint
        }
    }]
}

/**
    Check for possible problem - insufficient Ether balance inside the Formulas Contract.
*/
export async function checkEtherInnerBalance(instructionCode: number, address: Address, amount: BigNumber, contractAddress: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const contract = await contractFactory.getContractFormulas(contractAddress)
    const balance = bigNumberify(await contract.methods.etherBalances(address).call())

    if (balance.gte(amount)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: CommonErrorReasons.insufficientEtherInternal,
        errorType: ErrorTypes.warning,
        errorParameters: {
            ...errorParameters,
            contractAddress,
            balance,
            amount
        }
    }]
}

/**
    Check for possible problem - no contract deployed on adress where is expected.
*/
export async function checkNotContract(instructionCode: number, address: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    if (await contractFactory.isContract(address)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: CommonErrorReasons.noContractAtTokenAddress,
        errorType: ErrorTypes.error,
        errorParameters
    }]
}

/**
    Check for possible problem - target recieving asset is contract.

    Sending assets to contract is inherently insecure because there is no way to inform ERC20 and ERC721 contracts' functions
    that transaction is on behalf of another address and balance may be incorrectly added to sender instead
    (depending on the contract's inner workings).
*/
export async function checkTargetIsContract(instructionCode: number, targetEndpoint: BigNumber, targetAddress: Address, contractFactory: IContractFactory): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    if (!await contractFactory.isContract(targetAddress)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: CommonErrorReasons.targetIsContract,
        errorType: ErrorTypes.warning,
        errorParameters: {
            targetEndpoint,
            targetAddress
        }
    }]
}



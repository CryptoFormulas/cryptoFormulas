import {Address} from 'web3x/address'
import {IFormula} from '../IFormula'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {IAnalyzerResult, IContractFactory, ErrorTypes, IAssetDiff, emptyAssetState, IDictionary} from '../analysis'
import {IInstructionType} from './IInstructionType'
import {ITypes, ITypeAlias} from '../format'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'
import {checkSenderEndpointEmpty, checkTargetEndpointEmpty, checkSenderIsTarget, checkNotContract, checkTokenAddressEmpty, checkTargetIsContract} from './commonAnalysisChecks'


/**
    Instruction's custom problem reasons.
*/
export enum InstructionErrorReasons {
    noErc721ContractAtAddress = 'noErc721ContractAtAddress',
    noErc721TokenOwner = 'noErc721TokenOwner',
    noErc721Approval = 'noErc721Approval'
}

/**
    Instruction's combined problem reasons.
*/
export type ErrorReasons = CommonErrorReasons | InstructionErrorReasons

const instructionCode = 2

// instruction definition
const instruction: IInstructionType = {
    name: 'sendErc721',
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
            typeAlias: ITypeAlias.tokenId,
            name: 'tokenId'
        }, {
            type: ITypes.address,
            typeAlias: ITypeAlias.erc721Address,
            name: 'tokenAddress'
        }
    ],
    executionAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber, BigNumber, Address], contractAddress: Address, contractFactory: IContractFactory) => {
        const senderEndpoint = operands[0]
        const targetEndpoint = operands[1]

        const senderAddress = formula.endpoints[senderEndpoint.toNumber()]
        const targetAddress = formula.endpoints[targetEndpoint.toNumber()]
        const tokenId = operands[2]
        const tokenAddress = operands[3]

        const baseOwnershipErrorParameters = {
            senderEndpoint,
            senderAddress,
            tokenId,
            tokenAddress
        }

        const errorsSenderEmpty = checkSenderEndpointEmpty(instructionCode, senderEndpoint, senderAddress)
        const errorsTargetEmpty = checkTargetEndpointEmpty(instructionCode, targetEndpoint, targetAddress)
        const errorsTokenEmpty = checkTokenAddressEmpty(instructionCode, tokenAddress)

        // chain of checks that analysis if contract exists, sender has enough erc721 tokens, and proper allowence set
        const errorsIsContract = errorsTokenEmpty.length
            ? []
            : await checkNotContract(instructionCode, tokenAddress, contractFactory, {tokenAddress})
        const errorsIsContractErc721 = errorsTokenEmpty.length || errorsIsContract.length
            ? []
            : await checkNotContractErc721(instructionCode, tokenAddress, contractFactory, {tokenAddress})
        const errorsTokenBalance = errorsTokenEmpty.length || errorsIsContract.length || errorsIsContractErc721.length || errorsSenderEmpty.length
            ? []
            : await checkTokenOwner(instructionCode, tokenId, senderAddress, tokenAddress, contractFactory, baseOwnershipErrorParameters)
        const errorsTokenAllowance = errorsTokenEmpty.length || errorsIsContract.length || errorsIsContractErc721.length || errorsSenderEmpty.length || errorsTokenBalance.length
            ? []
            : await checkTokenAllowance(instructionCode, tokenId, senderAddress, tokenAddress, contractAddress, contractFactory, baseOwnershipErrorParameters)

        let errorList = []
            .concat(errorsSenderEmpty)
            .concat(errorsTargetEmpty)
            .concat(errorsTokenEmpty)
            .concat(errorsIsContract)
            .concat(errorsIsContractErc721)
            .concat(errorsTokenBalance)
            .concat(errorsTokenAllowance)

        if (!errorsSenderEmpty.length && !errorsTargetEmpty.length) {
            errorList = errorList.concat(checkSenderIsTarget(instructionCode, senderEndpoint, senderAddress, targetAddress))
        }

        if (!errorsTargetEmpty.length) {
            errorList = errorList.concat(await checkTargetIsContract(instructionCode, targetEndpoint, targetAddress, contractFactory))
        }

        return errorList
    },
    valueTransferAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber, BigNumber, Address], contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetDiff> => {
        const senderAddress = formula.endpoints[operands[0].toNumber()]
        const targetAddress = formula.endpoints[operands[1].toNumber()]
        const tokenId = operands[2]
        const tokenAddress = operands[3]

        const result = {
            positive: {
                ...emptyAssetState,
                erc721Balance: {
                    [operands[1].toNumber()]: {
                        [tokenAddress.toString()]: [tokenId]
                    }
                }
            },
            negative: {
                ...emptyAssetState,
                erc721Balance: {
                    [operands[0].toNumber()]: {
                        [tokenAddress.toString()]: [tokenId]
                    }
                },
                erc721Allowance: {
                    [operands[0].toNumber()]: {
                        [tokenAddress.toString()]: [tokenId]
                    }
                }
            }
        }

        return result
    }
}
export default instruction

/**
    Check for possible problem - no ERC721 contract deployed on adress where is expected.
*/
export async function checkNotContractErc721(instructionCode: number, address: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    if (await contractFactory.isErc721Contract(address)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.noErc721ContractAtAddress,
        errorType: ErrorTypes.error,
        errorParameters
    }]
}

/**
    Check for possible problem - sender is not a token owner.
*/
async function checkTokenOwner(instructionCode: number, tokenId: BigNumber, address: Address, contractAddress: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const tokenContract = await contractFactory.getContractErc721(contractAddress)
    const ownerAddress = await tokenContract.methods.ownerOf(tokenId).call()

    if (ownerAddress.equals(address)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.noErc721TokenOwner,
        errorType: ErrorTypes.warning,
        errorParameters: {
            ...errorParameters,
            tokenContract,
        }
    }]
}

/**
    Check for possible problem - sender set insufficient allowance for the Crypto Formulas contract.
*/
async function checkTokenAllowance(instructionCode: number, tokenId: BigNumber, senderAddress: Address, tokenAddress: Address, contractAddress: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const tokenContract = await contractFactory.getContractErc721(tokenAddress)
    const formulasContract = await contractFactory.getContractFormulas(contractAddress)

    const isApproved = false
        || (await tokenContract.methods.getApproved(tokenId).call()).equals(formulasContract.address)
        || await tokenContract.methods.isApprovedForAll(senderAddress, formulasContract.address).call()

    if (isApproved) {
        return []
    }
    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.noErc721Approval,
        errorType: ErrorTypes.warning,
        errorParameters: {
            ...errorParameters,
            tokenContract,
        }
    }]
}

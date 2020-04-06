import {Address} from 'web3x/address'
import {IFormula} from '../IFormula'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {IAnalyzerResult, IContractFactory, ErrorTypes, IAssetDiff, emptyAssetState, IDictionary} from '../analysis'
import {IInstructionType} from './IInstructionType'
import {ITypes, ITypeAlias} from '../format'
import {CommonErrorReasons} from '../instructions/CommonErrorReasons'
import {checkSenderEndpointEmpty, checkTargetEndpointEmpty, checkSenderIsTarget, checkNotContract, checkTokenAddressEmpty, checkTargetIsContract} from './commonAnalysisChecks'
import {Contract} from 'web3x/contract'
import {ContractFunctionEntry, ContractEntryDefinition} from 'web3x/contract/abi'
import {ContractAbi} from 'web3x/contract/abi/contract-abi'


/**
    Instruction's custom problem reasons.
*/
export enum InstructionErrorReasons {
    noErc721ContractAtAddress = 'noErc721ContractAtAddress',
    noErc721TokenOwner = 'noErc721TokenOwner',
    noErc721Approval = 'noErc721Approval',
    incompleteErc721_noApprovalCheck = 'incompleteErc721_noApprovalCheck',
    incompleteErc721_noApprovalForAll_missingApproval = 'incompleteErc721_noApprovalForAll_missingApproval',
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

    try {
        const isApproved = false
            || (await tokenContract.methods.getApproved(tokenId).call()).equals(formulasContract.address)
            || await tokenContract.methods.isApprovedForAll(senderAddress, formulasContract.address).call()

        if (isApproved) {
            return []
        }
    } catch (error) {
        // try to check approval in atypical contract
        const isApproved = await checkTokenAllowance_originalDraftErc721(formulasContract, tokenContract, tokenId)
        if (isApproved === null) {
            return [{
                instructionCode,
                errorReason: InstructionErrorReasons.incompleteErc721_noApprovalCheck,
                errorType: ErrorTypes.warning,
                errorParameters: {
                    ...errorParameters,
                    tokenContract,
                }
            }]
        }

        if (!isApproved) {
            return [{
                instructionCode,
                errorReason: InstructionErrorReasons.incompleteErc721_noApprovalForAll_missingApproval,
                errorType: ErrorTypes.warning,
                errorParameters: {
                    ...errorParameters,
                    tokenContract,
                }
            }]
        }

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

export const cryptoKittiesErc721Support = (erc721Contract: Contract<void>): Contract<void> => {
    const extraAbi: ContractEntryDefinition[] = [{
        constant: true,
        inputs: [
            {
                'name': '',
                'type': 'uint256'
            }
        ],
        name: 'kittyIndexToApproved',
        outputs: [
            {
                'name': '',
                'type': 'address'
            }
        ],
        payable: false,
        stateMutability: 'view' as 'view',
        type: 'function' as 'function'
    }]

    const kittyContract = appendAbiToContract(erc721Contract, extraAbi)

    return kittyContract
}

/*
    First draft of ERC721 hadn't methods `getApproved()` and `isApprovedForAll`,
    thus contracts implementing this obsolete standard can't be checked for approval
    in unified way.
*/
async function checkTokenAllowance_originalDraftErc721(formulasContract: Contract<void>, tokenContract: Contract<void>, tokenId: BigNumber): Promise<boolean | null> {
    // try CryptoKitties
    try {
        const extraAbi: ContractEntryDefinition[] = [{
            constant: true,
            inputs: [
                {
                    'name': '',
                    'type': 'uint256'
                }
            ],
            name: 'kittyIndexToApproved',
            outputs: [
                {
                    'name': '',
                    'type': 'address'
                }
            ],
            payable: false,
            stateMutability: 'view' as 'view',
            type: 'function' as 'function'
        }]

        const kittyContract = appendAbiToContract(tokenContract, extraAbi)
        const isApproved = (await kittyContract.methods.kittyIndexToApproved(tokenId).call()).equals(formulasContract.address)

        return isApproved
    } catch (error) {
        // pass
    }

    // no special ERC721 found
    return null
}

/*
    Clone the given contract and append additional ABI to its definition.
*/
function appendAbiToContract(contract: Contract<void>, abiToAppend: ContractEntryDefinition[]): Contract<void> {
    // this reads private contracts properties to overcome web3x missing Contract property `options`
    // as defined here https://web3js.readthedocs.io/en/v1.2.0/web3-eth-contract.html#new-contract
    // can be improved after https://github.com/xf00f/web3x/issues/79 is resolved

    const oldAbi = []
        .concat((contract as any).contractAbi.functions)
        .concat((contract as any).contractAbi.events)
        .concat((contract as any).contractAbi.ctor)
        .map(item => item.entry)
    //const oldAbi = contract.options.jsonInterface

    const newAbi: ContractAbi = new ContractAbi([
        ...oldAbi,
        ...abiToAppend,
    ])

    const newContract = new Contract<void>((contract as any).eth, newAbi, contract.address, (contract as any).defaultOptions)

    return newContract
}

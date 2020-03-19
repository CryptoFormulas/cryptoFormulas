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
    noErc20ContractAtAddress = 'noErc20ContractAtAddress',
    insufficientErc20Balance = 'insufficientErc20Balance',
    insufficientErc20Allowance = 'insufficientErc20Allowance'
}

/**
    Instruction's combined problem reasons.
*/
export type ErrorReasons = CommonErrorReasons | InstructionErrorReasons

const instructionCode = 1

// instruction definition
const instruction: IInstructionType = {
    name: 'sendErc20',
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
            typeAlias: ITypeAlias.tokenAmount,
            name: 'tokenAmount'
        }, {
            type: ITypes.address,
            typeAlias: ITypeAlias.erc20Address,
            name: 'tokenAddress'
        }
    ],
    executionAnalyzer: async (formula: IFormula, operands: [BigNumber, BigNumber, BigNumber, Address], contractAddress: Address, contractFactory: IContractFactory) => {
        const senderEndpoint = operands[0]
        const targetEndpoint = operands[1]

        const senderAddress = formula.endpoints[senderEndpoint.toNumber()]
        const targetAddress = formula.endpoints[targetEndpoint.toNumber()]
        const amount = operands[2]
        const tokenAddress = operands[3]

        const baseBalanceErrorParameters = {
            senderEndpoint,
            senderAddress,
            amount,
            tokenAddress,
        }

        const errorsSenderEmpty = checkSenderEndpointEmpty(instructionCode, senderEndpoint, senderAddress)
        const errorsTargetEmpty = checkTargetEndpointEmpty(instructionCode, targetEndpoint, targetAddress)
        const errorsTokenEmpty = checkTokenAddressEmpty(instructionCode, tokenAddress)

        // chain of checks that analysis if contract exists, sender has enough erc20 tokens, and proper allowence set
        const errorsIsContract = errorsTokenEmpty.length
            ? []
            : await checkNotContract(instructionCode, tokenAddress, contractFactory, {tokenAddress})
        const errorsIsContractErc20 = errorsTokenEmpty.length || errorsIsContract.length
            ? []
            : await checkNotContractErc20(instructionCode, tokenAddress, contractFactory, {tokenAddress})
        const errorsTokenBalance = errorsTokenEmpty.length || errorsIsContract.length || errorsIsContractErc20.length || errorsSenderEmpty.length
            ? []
            : await checkTokenBalance(instructionCode, amount, senderAddress, tokenAddress, contractFactory, baseBalanceErrorParameters)
        const errorsTokenAllowance = errorsTokenEmpty.length || errorsIsContract.length || errorsIsContractErc20.length || errorsSenderEmpty.length || errorsTokenBalance.length
            ? []
            : await checkTokenAllowance(instructionCode, amount, senderAddress, tokenAddress, contractAddress, contractFactory, baseBalanceErrorParameters)

        let errorList = []
            .concat(errorsSenderEmpty)
            .concat(errorsTargetEmpty)
            .concat(errorsTokenEmpty)
            .concat(errorsIsContract)
            .concat(errorsIsContractErc20)
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
        const amount = operands[2]
        const tokenAddress = operands[3]

        const result = {
            positive: {
                ...emptyAssetState,
                erc20Balance: {
                    [operands[1].toNumber()]: {
                        [tokenAddress.toString()]: amount
                    }
                }
            },
            negative: {
                ...emptyAssetState,
                erc20Balance: {
                    [operands[0].toNumber()]: {
                        [tokenAddress.toString()]: amount
                    }
                },
                erc20Allowance: {
                    [operands[0].toNumber()]: {
                        [tokenAddress.toString()]: amount
                    }
                }
            }
        }

        return result
    }
}
export default instruction

/**
    Check for possible problem - no ERC20 contract deployed on adress where is expected.
*/
async function checkNotContractErc20(instructionCode: number, address: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    if (await contractFactory.isErc20Contract(address)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.noErc20ContractAtAddress,
        errorType: ErrorTypes.error,
        errorParameters
    }]
}

/**
    Check for possible problem - sender has insufficient balance at the ERC20 token contract.
*/
async function checkTokenBalance(instructionCode: number, amount: BigNumber, address: Address, contractAddress: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const tokenContract = await contractFactory.getContractErc20(contractAddress)
    const balance = bigNumberify(await tokenContract.methods.balanceOf(address).call())
    if (balance.gte(amount)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.insufficientErc20Balance,
        errorType: ErrorTypes.warning,
        errorParameters: {
            ...errorParameters,
            tokenContract,
            balance
        }
    }]
}

/**
    Check for possible problem - sender set insufficient allowance for the Crypto Formulas contract.
*/
async function checkTokenAllowance(instructionCode: number, amount: BigNumber, senderAddress: Address, tokenAddress: Address, contractAddress: Address, contractFactory: IContractFactory, errorParameters: IDictionary<unknown>): Promise<IAnalyzerResult> {
    if (!contractFactory.isWeb3Available()) {
        return []
    }

    const tokenContract = await contractFactory.getContractErc20(tokenAddress)
    const allowance = await tokenContract.methods.allowance(senderAddress, contractAddress).call()

    if (amount.lte(allowance)) {
        return []
    }

    return [{
        instructionCode,
        errorReason: InstructionErrorReasons.insufficientErc20Allowance,
        errorType: ErrorTypes.warning,
        errorParameters: {
            ...errorParameters,
            tokenContract,
            allowance
        }
    }]
}

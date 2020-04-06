import {Eth} from 'web3x/eth'
import {IFormula} from '../../formula/IFormula'
import {Address} from 'web3x/address'
import {bigNumberify, BigNumber} from 'web3x/ethers/bignumber'
import {feeInstructionCode, instructionTypes} from '../instructions'
import {Contract} from 'web3x/contract'
import {IFormulaAnalysis, emptyAnalysis, IAbiGetter, ErrorTypes, PresignStates, IContractFactory, IAnalyzerResult, IAnalyzerResultError, IAssetState, IAssetDiff, emptyAssetDiff, emptyAssetState, IAssetBalances, ITransactionStats, emptyAssetBalances} from './IFormulaAnalysis'
import {ContractFactoryCachable} from './ContractFactoryCachable'
import * as AssetBalanceLogic from './AssetBalanceLogic'
import {cryptoKittiesErc721Support} from '../instructions/002_sendERC721'


/**
    Analyzes Formula. Reports problems that will likely prevent Formula from being successfully executed (missing balance, missing signatures, etc.).
*/
export async function analyzeFormula(eth: Eth, formula: IFormula, contractAddress: Address, abiGetter: IAbiGetter, stopOnAlreadyExecuted: boolean = false): Promise<IFormulaAnalysis> {
    const contractFactory = new ContractFactoryCachable(eth, abiGetter)

    const web3Available = await contractFactory.isWeb3Available()
    if (!web3Available) {
        return await analyzeStaticOnly(formula, contractAddress, contractFactory)
    }

    return await analyzeAll(formula, contractAddress, contractFactory, stopOnAlreadyExecuted)
}

async function analyzeStaticOnly(formula: IFormula, contractAddress: Address, contractFactory: ContractFactoryCachable) {
    const feeIndex = formula.operations.findIndex(item => item.instruction.eq(feeInstructionCode))

    // does formula has any operation or is meaningless (empty)?
    const isEmpty = !formula.operations.length

    const analysis: IFormulaAnalysis = {
        isComplete: false,
        formula,
        alreadyExecuted: null,
        feeMissing: !isEmpty && feeIndex < 0,
        feeIsLow: false, // 'fee is low' check not done when web3 not available
        isEmpty,
        operations: await prepareOperations(formula, contractAddress, contractFactory),
        presignes: [],
        assetsBalances: emptyAssetBalances,
        totals: { // will be overwritten
            errors: 0,
            warnings: 0
        }
    }

    // sum error counts
    const results = fillErrorTypeCounts(analysis)

    return results
}

async function analyzeAll(formula: IFormula, contractAddress: Address, contractFactory: ContractFactoryCachable, stopOnAlreadyExecuted: boolean) {
    const eth = await contractFactory.loadWeb3()
    const contract = await contractFactory.getContractFormulas(contractAddress)

    // was formula already executed on current network
    const alreadyExecuted = await contract.methods.executedFormulas(formula.messageHash).call()
    if (alreadyExecuted && stopOnAlreadyExecuted) {
        const results = fillErrorTypeCounts({
            ...emptyAnalysis,
            alreadyExecuted: await getExecutionTransaction(eth, contract, formula)
        })
        return results
    }

    // does formula has any operation or is meaningless (empty)?
    const isEmpty = !formula.operations.length

    // check fee
    const feePerOperation = bigNumberify(await contract.methods.feePerOperation().call())
    const feeIndex = formula.operations.findIndex(item => item.instruction.eq(feeInstructionCode))
    const feeIsLow = !isEmpty && feeIndex >= 0 && (formula.operations[feeIndex].operands[1] as BigNumber).lt(feePerOperation.mul(formula.operations.length))

    // result analysis
    const analysis: IFormulaAnalysis = {
        isComplete: true,
        formula,
        alreadyExecuted: alreadyExecuted ? await getExecutionTransaction(eth, contract, formula) : null,
        feeMissing: !isEmpty && feeIndex < 0,
        feeIsLow,
        isEmpty,
        operations: await prepareOperations(formula, contractAddress, contractFactory),
        presignes: await preparePresignes(contract, formula),
        assetsBalances: await prepareAssetBalances(formula, contractAddress, contractFactory),
        totals: { // will be overwritten
            errors: 0,
            warnings: 0
        }
    }

    // sum error counts
    const results = fillErrorTypeCounts(analysis)

    return results
}

/**
    Returns transaction in which given Formula was executed in current network.
*/
async function getExecutionTransaction(eth: Eth, formulasContract: Contract, formula: IFormula): Promise<ITransactionStats> {
    const events = await formulasContract.getPastEvents('Formulas_FormulaExecuted', {filter: {messageHash: formula.messageHash}})
    const relevantEvent = events[0]
    const block = await eth.getBlock(relevantEvent.blockNumber)

    const result = {
        number: block.number,
        timestamp: block.timestamp,
        transactionHash: relevantEvent.transactionHash
    }

    return result
}

/**
    Sums all problems in the analysis.
*/
function fillErrorTypeCounts(analysis: IFormulaAnalysis): IFormulaAnalysis {
    const countOperationErrors = (type: ErrorTypes) => analysis.operations.reduce((acc, items) => {
        return acc + items.filter(item => item.errorType == type).length
    }, 0)
    const countForbiddenPresignes = () => analysis.presignes.reduce((acc, item) => acc + (item == PresignStates.forbidden ? 1 : 0), 0)
    const countMissingAssets = () => Object.values(analysis.assetsBalances.missing).reduce((acc, item) => acc + Object.values(item).length, 0)

    const results: IFormulaAnalysis = {
        ...analysis,
        totals: {
            errors: 0
                + (analysis.alreadyExecuted && 1)
                + (analysis.feeMissing && 1)
                + (analysis.feeIsLow && 1)
                + (analysis.isEmpty && 1)
                + countOperationErrors(ErrorTypes.error)
                + countForbiddenPresignes(),
            warnings: 0
                + countOperationErrors(ErrorTypes.warning)
                + countMissingAssets()
            // TODO: when ERC721 token is missing multiple times add warning or error for each of such token
        }
    }

    return results
}

/**
    Check what presignes exists for the given Formula in Crypto Formulas contract.
*/
async function preparePresignes(contract: Contract, formula: IFormula): Promise<PresignStates[]> {
    const rawPresignes = await Promise.all(formula.endpoints.map(item => {
        return contract.methods.presignedFormulas(item, formula.messageHash).call()
    }))

    const results = rawPresignes.map(item => item as PresignStates)

    return results
}

/**
    Analyze operations.
*/
async function prepareOperations(formula: IFormula, contractAddress: Address, contractFactory: IContractFactory): Promise<IAnalyzerResult[]> {
    const analyzeOperations = (item) => {
        const instruction = instructionTypes[item.instruction.toNumber()]
        const operationAnalysis = instruction.executionAnalyzer(formula, item.operands, contractAddress, contractFactory)

        return operationAnalysis
    }
    const result = await Promise.all(formula.operations.map(analyzeOperations))

    return result
}

/**
    Calculates maximum required assets (at any time), current balances and missing balances for each relevant party and asset type.
*/
async function prepareAssetBalances(formula: IFormula, contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetBalances> {
    // calculate extreme, starting and missing balances
    const neededExtremes = await calculateMaximumExtremes(formula, contractAddress, contractFactory)
    const starting = await getCurrentBalances(formula, neededExtremes, contractAddress, contractFactory)
    const missing = AssetBalanceLogic.subStatesUnsigned(neededExtremes, starting)

    const rawResult = {
        starting,
        neededExtremes,
        missing
    }

    // remove empty (zero) values
    const cleanState = Object.keys(rawResult).reduce((acc, key) => {
        const result = {
            ...acc,
            [key]: AssetBalanceLogic.cleanState(rawResult[key])
        }

        return result
    }, {} as IAssetBalances)

    return cleanState
}

/**
    Get current asset balances for each party and asset type.
*/
async function getCurrentBalances(formula: IFormula, state: IAssetState, contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetState> {
    const eth = await contractFactory.loadWeb3()
    const formulasContract = await contractFactory.getContractFormulas(contractAddress)

    // generic reducer that gets current asset type balance
    const genericReducer = <T>(item: {[key: string]: unknown}, getBalance: (key: number | string) => Promise<T>) => async (accPromise, key) => {
        const acc = await accPromise
        try {
            const balance = await getBalance(key)

            const result = {
                ...acc,
                [key]: balance
            }

            return result
        } catch (error) {
            // TODO
            throw error
        }
    }

    // define reducers for all asset types
    const reducers = {
        etherInternal: genericReducer(state.etherInternal, async (endpointIndex: number) => bigNumberify(await formulasContract.methods.etherBalances(formula.endpoints[endpointIndex]).call())),
        etherExternal: genericReducer(state.etherExternal, async (endpointIndex: number) => bigNumberify(await eth.getBalance(formula.endpoints[endpointIndex]))),

        erc20Balance: async (accPromise: Promise<{[endpointIndex: number]: BigNumber}>, endpointIndex: number) => {
            const acc = await accPromise

            const reducer = genericReducer(state.erc20Balance[endpointIndex], async (tokenContractAddress: string): Promise<BigNumber> => {
                const contract = await contractFactory.getContractErc20(Address.fromString(tokenContractAddress))

                // check token balances
                try {
                    const balance = await contract.methods.balanceOf(formula.endpoints[endpointIndex]).call()
                    const balanceNumber = bigNumberify(balance)

                    return balanceNumber
                } catch (error) {
                    return bigNumberify(0)
                }
            })

            const result = {
                ...acc,
                [endpointIndex]: await Object.keys(state.erc20Balance[endpointIndex]).reduce(reducer, {})
            }

            return result
        },

        erc721Balance: async (accPromise: Promise<{[endpointIndex: number]: BigNumber}>, endpointIndex: number) => {
            const acc = await accPromise

            const reducer = genericReducer(state.erc721Balance[endpointIndex], async (contractAddress: string): Promise<BigNumber[]> => {
                const contract = await contractFactory.getContractErc721(Address.fromString(contractAddress))
                const tokenIds = state.erc721Balance[endpointIndex][contractAddress]

                // check who owns tokens
                const tokenOwnerSigns = await Promise.all(tokenIds.map(async (tokenId): Promise<BigNumber> => {
                    try {
                        const owner: Address = await contract.methods.ownerOf(tokenId).call()
                        const isOwner = owner.equals(formula.endpoints[endpointIndex])
                        const result = isOwner ? tokenId : undefined

                        return result
                    } catch (error) {
                        return undefined
                    }
                }))
                const ownedTokens = tokenOwnerSigns.filter(item => typeof item != 'undefined')

                return ownedTokens
            })

            const result = {
                ...acc,
                [endpointIndex]: await Object.keys(state.erc721Balance[endpointIndex]).reduce(reducer, {})
            }

            return result
        },
        erc20Allowance: async (accPromise: Promise<{[endpointIndex: number]: BigNumber}>, endpointIndex: number) => {
            const acc = await accPromise

            const reducer = genericReducer(state.erc20Allowance[endpointIndex], async (tokenContractAddress: string): Promise<BigNumber> => {
                const contract = await contractFactory.getContractErc20(Address.fromString(tokenContractAddress))

                // check token allowance
                try {
                    const allowance = await contract.methods.allowance(formula.endpoints[endpointIndex], contractAddress).call()
                    const allowanceNumber = bigNumberify(allowance)

                    return allowanceNumber
                } catch (error) {
                    return bigNumberify(0)
                }
            })

            const result = {
                ...acc,
                [endpointIndex]: await Object.keys(state.erc20Allowance[endpointIndex]).reduce(reducer, {})
            }

            return result
        },
        erc721Allowance: async (accPromise: Promise<{[endpointIndex: number]: BigNumber}>, endpointIndex: number) => {
            const acc = await accPromise
            const reducer = genericReducer(state.erc721Allowance[endpointIndex], async (tokenContractAddress: string): Promise<BigNumber[] | typeof Infinity> => {
                const contract = await contractFactory.getContractErc721(Address.fromString(tokenContractAddress))
                const tokenIds = state.erc721Allowance[endpointIndex][tokenContractAddress]

                try {
                    // is approved for all tokens?
                    const approvedForAll = await contract.methods.isApprovedForAll(formula.endpoints[endpointIndex], contractAddress).call()
                    if (approvedForAll) {
                        return Infinity // approval for all tokens
                    }

                    // is not approved for all, but such approval is requested?
                    if (tokenIds == Infinity) {
                        return [] // approval for nothing
                    }
                } catch (error) {
                    // pass
                }

                // setup approval check - support some old original-draft-ERC721 tokens
                const suppForDeprecatedErc = cryptoKittiesErc721Support(contract)
                const checkTokenApproval = async (contract: Contract<void>, tokenId) => {
                    try {
                        const result = await contract.methods.getApproved(tokenId).call()

                        return result
                    } catch (error) {
                        // pass
                    }

                    try {
                        const result = await suppForDeprecatedErc.methods.kittyIndexToApproved(tokenId).call()

                        return result
                    } catch (error) {
                        // pass
                    }

                    return undefined
                }

                // check who is approved to control particular tokens
                const tokenOwnerSigns = await Promise.all((tokenIds as BigNumber[]).map(async (tokenId): Promise<BigNumber> => {
                    try {
                        const operator: Address = await checkTokenApproval(contract, tokenId)
                        const isOwner = operator.equals(contractAddress)
                        const result = isOwner ? tokenId : undefined

                        return result
                    } catch (error) {
                        return undefined
                    }
                }))
                const ownedTokens = tokenOwnerSigns.filter(item => typeof item != 'undefined')

                return ownedTokens
            })

            const result = {
                ...acc,
                [endpointIndex]: await Object.keys(state.erc721Allowance[endpointIndex]).reduce(reducer, {})
            }

            return result
        },
    }

    // apply all reducers to calculate overall current balances of everything relevant
    const result = await Object.keys(reducers).reduce(async (accPromise, key) => {
        const acc = await accPromise

        const result = {
            ...acc,
            [key]: await Object.keys(state[key]).reduce(reducers[key], Promise.resolve({}))
        }

        return result
    }, Promise.resolve({} as IAssetState))

    return result
}

/**
    Calculate balances that will be needed by sending endpoints (parties) for Formula to successfully execute.
    Calculation reflects changes after each operation calculation.
*/
async function calculateMaximumExtremes(formula: IFormula, contractAddress: Address, contractFactory: IContractFactory): Promise<IAssetState> {
    const initValue = Promise.resolve({
        current: emptyAssetDiff,
        extremes: emptyAssetState
    })
    const results = await formula.operations.reduce(async (accPromise, item) => {
        const acc = await accPromise
        const instruction = instructionTypes[item.instruction.toNumber()]

        // calculate what changes will operation cause
        const stateDiff = await instruction.valueTransferAnalyzer(formula, item.operands, contractAddress, contractFactory)

        // calculate only expenses from this operation (needed for cases when endpoint sends asset from itself to itself)
        const localNegativeExtremes = calculateNegativeExtremes(acc.current, stateDiff)

        // calculate new maximum extremes
        const newRawDiff = AssetBalanceLogic.addTwoDiffs(acc.current, stateDiff)
        const newDiff = AssetBalanceLogic.normalizeDiff(newRawDiff)

        // compare current extremes with previous extremes and get maximums
        const extremes = AssetBalanceLogic.maxState(acc.extremes, newDiff.negative, localNegativeExtremes)

        const results = {
            current: newDiff,
            extremes
        }

        return results
    }, initValue)

    return results.extremes
}

/**
    Sums current asset type required amounts with next operation requirements.
*/
function calculateNegativeExtremes(currentStateDiff: IAssetDiff, change: IAssetDiff) {
    const onlyNegativeChange = {
        positive: emptyAssetState,
        negative: change.negative
    }
    const newRawDiff = AssetBalanceLogic.addTwoDiffs(currentStateDiff, onlyNegativeChange)
    const localExtremes = AssetBalanceLogic.normalizeDiff(newRawDiff)

    return localExtremes.negative
}

import {bigNumberify, BigNumber} from 'web3x/ethers/bignumber'
import {IAssetState, IAssetDiff, emptyAssetDiff, emptyAssetState} from './IFormulaAnalysis'


/////////////////// Asset Balance State ////////////////////////////////////////

interface INestingBase<T> {
    [key: string]: T
}

interface ICombineFunc<T> {
    (valueA: T, valueB: T): T
}

interface IFilterFunc<T> {
    (value: T): T | undefined
}

interface IStateCombineFunctions {
    etherInternal: ICombineFunc<BigNumber> // Ethereum balance inside the Crypto Formulas contract
    etherExternal: ICombineFunc<BigNumber> // Ethereum balance directly in the address
    erc20Balance: ICombineFunc<{[tokenContractAddress: string]: BigNumber}>
    erc721Balance: ICombineFunc<{[tokenContractAddress: string]: BigNumber[]}>
    erc20Allowance: ICombineFunc<{[tokenContractAddress: string]: BigNumber}>
    erc721Allowance: ICombineFunc<{[tokenContractAddress: string]: BigNumber[] | typeof Infinity}>
}

interface IStateFilterFunctions {
    etherInternal: IFilterFunc<BigNumber>
    etherExternal: IFilterFunc<BigNumber>
    erc20Balance: IFilterFunc<{[tokenContractAddress: string]: BigNumber}>
    erc721Balance: IFilterFunc<{[tokenContractAddress: string]: BigNumber[]}>
    erc20Allowance: IFilterFunc<{[tokenContractAddress: string]: BigNumber}>
    erc721Allowance: IFilterFunc<{[tokenContractAddress: string]: BigNumber[] | typeof Infinity}>
}


/////////////////// Logic //////////////////////////////////////////////////////

/**
    Adds two states. Positive and negative values are treated separately.
    Consider normalizing result state to get the state's simplest representation.
*/
export function addTwoStates(stateA: IAssetState, stateB: IAssetState): IAssetState {
    const addNumbers = (valueA: BigNumber, valueB: BigNumber) => valueA.add(valueB)
    const addErc20 = (valueA: {[tokenContractAddress: string]: BigNumber}, valueB: {[tokenContractAddress: string]: BigNumber}) => {
        const newValue = reduceDictionaries(valueA, valueB, addNumbers, bigNumberify(0))

        return newValue
    }
    const addErc721 = (valueA: {[tokenContractAddress: string]: BigNumber[]}, valueB: {[tokenContractAddress: string]: BigNumber[]}) => {
        const concatTokenIds = (tokensA: BigNumber[], tokensB: BigNumber[]) => tokensA.concat(tokensB).filter((item, index, self) => self.indexOf(item) == index)
        const newValue = reduceDictionaries(valueA, valueB, concatTokenIds, [])

        return newValue
    }
    const addErc721Allowance = (valueA: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}, valueB: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}) => {
        const concatTokenIds = (tokensA: BigNumber[] | typeof Infinity, tokensB: BigNumber[] | typeof Infinity) => {
            if (tokensA == Infinity || tokensB == Infinity) {
                return Infinity
            }
            const result = (tokensA as BigNumber[]).concat(tokensB as BigNumber[]).filter((item, index, self) => self.indexOf(item) == index)

            return result
        }
        const newValue = reduceDictionaries(valueA, valueB, concatTokenIds, [])

        return newValue
    }

    const addFunctions = {
        etherInternal: addNumbers,
        etherExternal: addNumbers,
        erc20Balance: addErc20,
        erc721Balance: addErc721,
        erc20Allowance: addErc20,
        erc721Allowance: addErc721Allowance,
    }

    const newState = reduceStates(stateA, stateB, addFunctions)

    return newState
}

/**
    Annihilate same portion of positive and negative values to get the state's simplest form.
*/
export function normalizeDiff(diff: IAssetDiff): IAssetDiff {
    const newDiff = {
        positive: subStatesUnsigned(diff.positive, diff.negative),
        negative: subStatesUnsigned(diff.negative, diff.positive),
    }

    return newDiff
}

/**
    Remove empty values from the state.
*/
export function cleanState(state: IAssetState): IAssetState {
    const isPositive = (item: BigNumber) => item.gt(0) ? item : undefined

    const cleanErc20 = (endpointInfo: {[tokenContractAddress: string]: BigNumber}) => {
        const newDictionary = filterDictionary(endpointInfo, (item: any) => isPositive(bigNumberify(item)))
        const result = Object.keys(newDictionary).length
            ? newDictionary
            : undefined

        return  result
    }
    const cleanErc721 = (item: {[tokenContractAddress: string]: BigNumber[]}) => {
        const filterTokenIds = (tokenIds: BigNumber[]) => tokenIds.length ? tokenIds : undefined
        const newDictionary = filterDictionary(item, filterTokenIds)

        const result = Object.keys(newDictionary).length
            ? newDictionary
            : undefined

        return result
    }
    const cleanErc721Allowance = (item: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}) => {
        const filterTokenIds = (tokenIds: BigNumber[] | typeof Infinity) => {
            if (tokenIds == Infinity) {
                return Infinity
            }
            const result = (tokenIds as BigNumber[]).length ? tokenIds : undefined

            return result
        }
        const newDictionary = filterDictionary(item, filterTokenIds)

        const result = Object.keys(newDictionary).length
            ? newDictionary
            : undefined

        return result
    }

    const filterFunctions = {
        etherInternal: isPositive,
        etherExternal: isPositive,

        erc20Balance: cleanErc20,
        erc721Balance: cleanErc721,
        erc20Allowance: cleanErc20,
        erc721Allowance: cleanErc721Allowance,
    }

    const newState = filterState(state, filterFunctions)

    return newState
}

/**
    Adds two state diffs.
*/
export function addTwoDiffs(diffA: IAssetDiff, diffB: IAssetDiff): IAssetDiff {
    const newDiff = {
        positive: addTwoStates(diffA.positive, diffB.positive),
        negative: addTwoStates(diffA.negative, diffB.negative),
    }

    return newDiff
}

/**
    Select maximum values from multiple states and combine them togehter.
*/
export function maxState(stateA: IAssetState, stateB: IAssetState, ...extraStates: IAssetState[]) {
    const maxNumbers = (valueA: BigNumber, valueB: BigNumber) => valueA.gte(valueB) ? valueA : valueB
    const maxErc20 = (valueA: {[tokenContractAddress: string]: BigNumber}, valueB: {[tokenContractAddress: string]: BigNumber}) => {
        const newValue = reduceDictionaries(valueA, valueB, maxNumbers, bigNumberify(0))

        return newValue
    }

    const calcErc721Cardanility = (tokenIds: BigNumber[]) => tokenIds.reduce((acc, item) => {
        const stringNumber = item.toString()
        if (!acc[stringNumber]) {
            acc[stringNumber] = 0
        }
        acc[stringNumber]++

        return acc
    }, {})

    const erc721MaxIds = (tokensA: BigNumber[], tokensB: BigNumber[]) => {
        const cardinalityA = calcErc721Cardanility(tokensA)
        const cardinalityB = calcErc721Cardanility(tokensB)

        // copy all tokenIds from `tokensA` set - multiple times when token was present multiple times there
        const tmpA = Object.keys(cardinalityA).reduce((acc, key) => {
            const bigNumber = bigNumberify(key)
            const newItems = Array(cardinalityA[key]).fill(bigNumber)
            const newAcc = acc.concat(newItems)

            return newAcc
        }, [])
        // copy all tokenIds from `tokensB` that can be maxed to `tokensA`
        const tmpB = Object.keys(cardinalityB).reduce((acc, key) => {
            const missingCount = cardinalityB[key] - (cardinalityA[key] || 0)
            if (missingCount <= 0) {
                return acc
            }

            const bigNumber = bigNumberify(key)
            const newItems = Array(missingCount).fill(bigNumber)
            const newAcc = acc.concat(newItems)

            return newAcc
        }, [])

        const result = tmpA.concat(tmpB)

        return result
    }
    const maxErc721 = (valueA: {[tokenContractAddress: string]: BigNumber[]}, valueB: {[tokenContractAddress: string]: BigNumber[]}) => {
        const newValue = reduceDictionaries(valueA, valueB, erc721MaxIds, [])

        return newValue
    }
    const maxErc721Allowance = (valueA: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}, valueB: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}) => {
        const concatTokenIds = (tokensA: BigNumber[] | typeof Infinity, tokensB: BigNumber[] | typeof Infinity) => {
            if (tokensA == Infinity || tokensB == Infinity) {
                return Infinity
            }

            // TODO: rework - this filter works only by accident
            const result = (tokensA as BigNumber[]).concat(tokensB as BigNumber[]).filter((item, index, self) => self.indexOf(item) == index)

            return result
        }
        const newValue = reduceDictionaries(valueA, valueB, concatTokenIds, [])

        return newValue
    }

    const maxFunctions = {
        etherInternal: maxNumbers,
        etherExternal: maxNumbers,
        erc20Balance: maxErc20,
        erc721Balance: maxErc721,
        erc20Allowance: maxErc20,
        erc721Allowance: maxErc721Allowance,
    }

    const newState = reduceStates(stateA, stateB, maxFunctions)

    if (!extraStates.length) {
        return newState
    }

    return maxState(newState, extraStates[0], ...extraStates.slice(1))
}

/**
    Select maximum values from multiple states and combine them togehter.
*/
export function subStatesUnsigned(stateA: IAssetState, stateB: IAssetState): IAssetState {
    const subNumbers = (valueA: BigNumber, valueB: BigNumber) => {
        const newValue = valueA.sub(valueB)
        const result = newValue.gte(0) ? newValue : bigNumberify(0)

        return result
    }
    const subErc20 = (valueA: {[tokenContractAddress: string]: BigNumber}, valueB: {[tokenContractAddress: string]: BigNumber}) => {
        const newValue = reduceDictionaries(valueA, valueB, subNumbers, bigNumberify(0))

        return newValue
    }
    const subErc721 = (valueA: {[tokenContractAddress: string]: BigNumber[]}, valueB: {[tokenContractAddress: string]: BigNumber[]}) => {
        const substractTokenIds = (tokensA: BigNumber[], tokensB: BigNumber[]) => {
            const resultTokens = [...tokensA]
            tokensB.forEach(item => {
                const itemIndex = resultTokens.findIndex(tmpItem => item.eq(tmpItem))
                if (itemIndex < 0) {
                    return
                }

                resultTokens.splice(itemIndex, 1)
            })

            return resultTokens
        }
        const newValue = reduceDictionaries(valueA, valueB, substractTokenIds, [])

        return newValue
    }
    const subErc721Allowance = (valueA: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}, valueB: {[tokenContractAddress: string]: BigNumber[] | typeof Infinity}) => {
        const concatTokenIds = (tokensA: BigNumber[] | typeof Infinity, tokensB: BigNumber[] | typeof Infinity) => {
            if (tokensA == Infinity) {
                return Infinity
            }

            if (tokensB == Infinity) {
                return []
            }

            const result = (tokensA as BigNumber[]).filter((item) => (tokensB as BigNumber[]).indexOf(item) < 0)

            return result
        }
        const newValue = reduceDictionaries(valueA, valueB, concatTokenIds, [])

        return newValue
    }

    const subFunctions = {
        etherInternal: subNumbers,
        etherExternal: subNumbers,
        erc20Balance: subErc20,
        erc721Balance: subErc721,
        erc20Allowance: subErc20,
        erc721Allowance: subErc721Allowance,
    }

    const newState = reduceStates(stateA, stateB, subFunctions)

    return newState
}

/**
    Apply abstract reducer to each asset type.
*/
function reduceStates<T>(stateA: IAssetState, stateB: IAssetState, combineFunctions: IStateCombineFunctions): IAssetState {
    const defaultValues = {
        etherInternal: bigNumberify(0),
        etherExternal: bigNumberify(0),
        erc20Balance: {},
        erc721Balance: {},
        erc20Allowance: {},
        erc721Allowance: {},
    }

    const newState = Object.keys(combineFunctions).reduce((acc, key) => {
        const result = {
            ...acc,
            [key]: reduceDictionaries<T>(stateA[key], stateB[key], combineFunctions[key], defaultValues[key])
        }

        return result
    }, emptyAssetState)

    return newState
}

/**
    Apply abstract filter function to each asset type.
*/
function filterState<T>(state: IAssetState, filterFunctions: IStateFilterFunctions): IAssetState {
    const newState = Object.keys(filterFunctions).reduce((acc, key) => {
        const result = {
            ...acc,
            [key]: filterDictionary<T>(state[key], filterFunctions[key])
        }

        return result
    }, emptyAssetState)

    return newState
}


/**
    Apply abstract reducer to asset type.
*/
function reduceDictionaries<T>(stateA: INestingBase<T>, stateB: INestingBase<T>, addFunction: ICombineFunc<T>, defaultValue: T): INestingBase<T> {
    const newState = Object.keys(stateB).reduce((acc, key) => {
        const ensuredStateA = typeof acc[key] == 'undefined' ? defaultValue : acc[key]
        const newValue = {
            ...acc,
            [key]: addFunction(ensuredStateA, stateB[key])
        }

        return newValue
    }, {...stateA})

    return newState
}

/**
    Apply abstract filter function to asset type.
*/
function filterDictionary<T>(state: INestingBase<T>, filterFunction: IFilterFunc<T>): INestingBase<T> {
    const newState = Object.keys(state).reduce((acc, key) => {
        const newState = filterFunction(state[key])
        if (typeof newState == 'undefined') {
            return acc
        }

        const newValue = {
            ...acc,
            [key]: newState
        }

        return newValue
    }, {})

    return newState
}

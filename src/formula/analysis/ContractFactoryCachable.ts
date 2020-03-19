import {Eth} from 'web3x/eth'
import {Address} from 'web3x/address'
import {ContractFactory} from './ContractFactory'
import {IAbiGetter} from './IFormulaAnalysis'


/**
    Factory for supported types of Ethereum contracts on active Ethereum network.
    Caches information that will certantly not change during analysis.
*/
export class ContractFactoryCachable extends ContractFactory {

    private cache: {[key: string]: {[key: string]: boolean}} = {}

    public constructor(protected eth: Eth, protected abiGetter: IAbiGetter) {
        super(eth, abiGetter)
    }

    /*
        Check if address on current network appears to be Crypto Formulas contract.
    */
    public async isContract(contractAddress: Address): Promise<boolean> {
        this.cache.isContract = this.cache.isContract || {}

        const cacheKey = contractAddress.toString()
        if (cacheKey in this.cache.isContract) {
            return this.cache.isContract[cacheKey]
        }

        const result = await super.isContract(contractAddress)
        this.cache.isContract[cacheKey] = result

        return result
    }

    /*
        Check if address on current network appears to be ERC20 contract.
    */
    public async isErc20Contract(contractAddress: Address): Promise<boolean> {
        this.cache.isErc20Contract = this.cache.isErc20Contract || {}

        const cacheKey = contractAddress.toString()
        if (cacheKey in this.cache.isErc20Contract) {
            return this.cache.isErc20Contract[cacheKey]
        }

        const result = await super.isErc20Contract(contractAddress)
        this.cache.isErc20Contract[cacheKey] = result

        return result
    }

    /*
        Check if address on current network appears to be ERC721 contract.
    */
    public async isErc721Contract(contractAddress: Address): Promise<boolean> {
        this.cache.isErc721Contract = this.cache.isErc721Contract || {}

        const cacheKey = contractAddress.toString()
        if (cacheKey in this.cache.isErc721Contract) {
            return this.cache.isErc721Contract[cacheKey]
        }

        const result = await super.isErc721Contract(contractAddress)
        this.cache.isErc721Contract[cacheKey] = result

        return result
    }
}

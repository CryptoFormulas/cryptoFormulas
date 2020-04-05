import {Eth} from 'web3x/eth'
import {ContractEntryDefinition} from 'web3x/contract/abi/contract-abi-definition'
import {ContractAbi} from 'web3x/contract/abi/contract-abi'
import {ABICoder} from 'web3x/contract/abi-coder'
import {IContractFactory} from './IFormulaAnalysis'
import {Contract} from 'web3x/contract'
import {IAbiGetter} from './IFormulaAnalysis'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'

/**
    Factory for supported types of Ethereum contracts on active Ethereum network.
*/
export class ContractFactory implements IContractFactory {

    public constructor(protected eth: Eth, protected abiGetter: IAbiGetter) {

    }

    public isWeb3Available(): boolean {
        return !!this.eth
    }

    /**
        Create contract object from given ABI.
    */
    private async createContractFromCompiled(abi: ContractEntryDefinition[], address: Address = undefined): Promise<Contract> {
        const abiObject = new ContractAbi(abi)
        const contract = new Contract(this.eth, abiObject, address || undefined)

        return contract
    }

    /**
        Returns web3 object.
    */
    public async loadWeb3(): Promise<Eth> {
        return this.eth
    }

    /*
        Check if address on current network appears to be Crypto Formulas contract.
    */
    public async isContract(contractAddress: Address): Promise<boolean> {
        const eth = await this.loadWeb3()
        const tokenContractCode = await eth.getCode(contractAddress)

        return tokenContractCode && tokenContractCode != '0x'
    }

    /*
        Check if address on current network appears to be ERC20 contract.
    */
    public async isErc20Contract(contractAddress: Address): Promise<boolean> {
        if (!await this.isContract(contractAddress)) {
            return false
        }

        const eth = await this.loadWeb3()
        const account1 = Account.create()
        const account2 = Account.create()

        // naive way of checking contract for the method presence (because there is no solid way to do that now)
        // it checks for existance of main methods used by Crypto Formulas contract
        try {
            const contract = await this.getContractErc20(contractAddress)
            await contract.methods.allowance(account1.address, account2.address).call() // any non-error result is ok
            await contract.methods.balanceOf(account1.address).call() // any non-error result is ok

            const tokenContractCode = await eth.getCode(contractAddress)
            const coder = new ABICoder()
            const methodSignature = 'transferFrom(address,address,uint256)'
            const signature = coder.encodeFunctionSignature(methodSignature).replace(/^0x/, '')
            const result = tokenContractCode.includes('63' + signature)

            return result
        } catch (error) {
            return false
        }
    }

    /*
        Check if address on current network appears to be ERC721 contract.
    */
    public async isErc721Contract(contractAddress: Address): Promise<boolean> {
        if (!await this.isContract(contractAddress)) {
            return false
        }

        // naive way of checking contract for the method presence (because there is no solid way to do that now)
        try {
            // see ERC721 implementation for signature computation
            const ierc721Signature = '0x80ac58cd' // minimum ERC721
            const ierc721WithMetadataSignature = '0x9a20483d' // first draft of ERC721, including metadata (as defined in https://github.com/ethereum/EIPs/issues/721 and used by CryptoKitties https://etherscan.io/address/0x06012c8cf97bead5deae237070f9587f8e7a266d#code)

            const contract = await this.getContractErc721(contractAddress)
            const result = false
                || await contract.methods.supportsInterface(ierc721Signature).call()
                || await contract.methods.supportsInterface(ierc721WithMetadataSignature).call()

            return result
        } catch (error) {
            return false
        }
    }

    /*
        Returns Crypto Formulas contract object on current network.
    */
    public async getContractFormulas(contractAddress: Address): Promise<Contract> {
        return await this.createContractFromCompiled(await this.abiGetter('formulas'), contractAddress)
    }

    /*
        Returns ERC20 contract object on current network.
    */
    public async getContractErc20(contractAddress: Address): Promise<Contract> {
        return await this.createContractFromCompiled(await this.abiGetter('erc20'), contractAddress)
    }

    /*
        Returns ERC721 contract object on current network.
    */
    public async getContractErc721(contractAddress: Address): Promise<Contract> {
        return await this.createContractFromCompiled(await this.abiGetter('erc721'), contractAddress)
    }
}

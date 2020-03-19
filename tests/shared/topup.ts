import {assert} from 'chai'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'
import {Contract} from 'web3x/contract'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {testingTools} from 'soliditySapper'


/**
    Balance state for all accounts and asset types.
*/
export interface IBalances {
    [user: number]: {
        eth?: number | BigNumber
        ethInner?: number | BigNumber
        tokenErc20?: number
        tokenErc721?: (number | BigNumber)[]
        tokenErc721ExtraAllowance?: boolean
    }
}

/**
    Input parameters for assets topup.
*/
export interface ITopupEnvironment {
    prerequisities: testingTools.IPrerequisities
    universalDonor: Address
    formulasContract: Contract
    tokenErc20Contract: Contract // erc20 contract
    tokenErc721Contract: Contract // erc721 contract
}

const tmpGas = {gas: 1000000, gasPrice: 2000}
const premiumForGasFees = bigNumberify(1).mul(10 ** 13) // 1 ether

/**
    Top ups all assets type to accounts.
*/
export async function topupAccounts(accounts: Account[], balances: IBalances, env: ITopupEnvironment): Promise<void> {

    await accounts.reduce(async (accPromise, account, index) => {
        await accPromise
        const amounts = Object.values(balances)[index]

        await topupEth(env, account, bigNumberify(amounts.ethInner || 0))
        await topupTokenErc20(env, account, bigNumberify(amounts.tokenErc20 || 0))
        await topupTokenErc721(env, account, amounts.tokenErc721 || [], amounts.tokenErc721ExtraAllowance)
    }, Promise.resolve())
}

/**
    Top ups ether into the Crypto Formulas contract.
*/
async function topupEth(env: ITopupEnvironment, account: Account, amount: BigNumber) {
    if (amount.lte(0)) {
        return
    }
    const amountWithGas = amount.add(premiumForGasFees).toString()

    // send eth to address
    await env.prerequisities.servant.eth.sendTransaction({from: env.universalDonor, to: account.address, value: amountWithGas}).getReceipt()

    // send eth from address to
    const tx = env.formulasContract.methods.topUpEther()

    await account.sendTransaction({to: env.formulasContract.address, value: amount.toString(), data: tx.encodeABI(), ...tmpGas}, env.prerequisities.servant.eth).getReceipt()
}

/**
    Top ups ERC20 tokens to target address and set's allowance for the Crypto Formulas contract.
*/
async function topupTokenErc20(env: ITopupEnvironment, account: Account, amount: BigNumber) {
    if (amount.lte(0)) {
        return
    }

    // send eth for fees to address
    await env.prerequisities.servant.eth.sendTransaction({from: env.universalDonor, to: account.address, value: premiumForGasFees.toString()}).getReceipt()

    // send token to address
    await env.tokenErc20Contract.methods.transfer(account.address, amount).send({from: env.universalDonor}).getReceipt()

    const allowanceTxData = env.tokenErc20Contract.methods.approve(env.formulasContract.address, amount).encodeABI()
    await account.sendTransaction({data: allowanceTxData, to: env.tokenErc20Contract.address, ...tmpGas}, env.prerequisities.servant.eth).getReceipt()

    const allowance1 = await env.tokenErc20Contract.methods.allowance(account.address, env.formulasContract.address).call()
    assert.equal(allowance1, amount, 'Couldn\'t set token allowence')
}

/**
    Top ups ERC721 tokens to target address and set's allowance for the Crypto Formulas contract.
*/
async function topupTokenErc721(env: ITopupEnvironment, account: Account, tokenIds: BigNumber[], extraAllowance: boolean) {
    if (!tokenIds.length && !extraAllowance) {
        return
    }

    // send eth for fees to address
    await env.prerequisities.servant.eth.sendTransaction({from: env.universalDonor, to: account.address, value: premiumForGasFees.toString()}).getReceipt()

    //await Promise.all(tokenIds.map(async (tokenId, index) => {
    await tokenIds.reduce(async (acc, tokenId, index) => {
        await acc

        // send token to address
        await env.tokenErc721Contract.methods.transferFrom(env.universalDonor, account.address, tokenId).send({from: env.universalDonor}).getReceipt()
        assert.equal((await env.tokenErc721Contract.methods.ownerOf(tokenId).call()).toString(), account.address.toString())
    }, Promise.resolve())

    const approvalTxData = await env.tokenErc721Contract.methods.setApprovalForAll(env.formulasContract.address, true).encodeABI()
    await account.sendTransaction({data: approvalTxData, to: env.tokenErc721Contract.address, ...tmpGas}, env.prerequisities.servant.eth).getReceipt()

    const isApproved = await env.tokenErc721Contract.methods.isApprovedForAll(account.address, env.formulasContract.address).call()
    assert.isTrue(isApproved, 'Nonfungible token topup fail')
}

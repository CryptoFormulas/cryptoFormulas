import {assert} from 'chai'
import {Account} from 'web3x/account'
import {AddressZero} from 'web3x/ethers/constants'
import {testingTools} from 'soliditySapper'
import {deployEtherMartyr, deployFormulaDebugger} from './formulaDebugger'
import {deployERC20, deployERC721} from './formulaTest'

const gasLogNamespace = 'DonationWithrdawal'

const testDonationWithdrawal = (prerequisities: testingTools.IPrerequisities) => async () => {
    it('withdraw eth', async () => {
        const amount = 100

        const {contract: formulasContract, deployer: formulasDeployer} = await deployFormulaDebugger(prerequisities)
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), 0)

        const {contract: martyrContract, deployer: martyrDeployer} = await deployEtherMartyr(prerequisities, formulasContract.address, amount)
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), amount)

        const account = Account.create()
        const response = await formulasContract.methods.withdrawDonations(0, account.address, amount, AddressZero).send({from: formulasDeployer}).getReceipt()
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'ether', response.transactionHash)

        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), 0)
        assert.equal(await prerequisities.eth.getBalance(account.address), amount)
    })

     it('withdraw eth after someone else deposited eth', async () => {
        const tmpGas = {gas: 1000000, gasPrice: 2000}
        const amount = 100
        const preload = 133

        const {contract: formulasContract, deployer: formulasDeployer} = await deployFormulaDebugger(prerequisities)
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), 0)

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const account1 = Account.create()
        const account2 = Account.create()

        await prerequisities.eth.sendTransaction({from: universalDonor, to: account1.address, value: 10 ** 13 + preload}).getReceipt()

        // send user's ether
        const tx = formulasContract.methods.topUpEther()
        await account1.sendTransaction({to: formulasContract.address, value: preload, data: tx.encodeABI(), ...tmpGas}, prerequisities.servant.eth).getReceipt()
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), preload)

        // deposit extra eth
        const {contract: martyrContract, deployer: martyrDeployer} = await deployEtherMartyr(prerequisities, formulasContract.address, amount)
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), amount + preload)

        // withraw extra eth
        const response = await formulasContract.methods.withdrawDonations(0, account2.address, amount, AddressZero).send({from: formulasDeployer}).getReceipt()
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'ether', response.transactionHash)

        // check withdrawal success
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), preload)
        assert.equal(await prerequisities.eth.getBalance(account2.address), amount)
    })

    it('rejects withdrawal of ether belonging to contract user', async () => {
        const tmpGas = {gas: 1000000, gasPrice: 2000}
        const amount = 100
        const preload = 133

        const {contract: formulasContract, deployer: formulasDeployer} = await deployFormulaDebugger(prerequisities)
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), 0)

        const universalDonor = (await prerequisities.servant.eth.getAccounts())[0]
        const account1 = Account.create()
        const account2 = Account.create()

        await prerequisities.eth.sendTransaction({from: universalDonor, to: account1.address, value: 10 ** 13 + preload}).getReceipt()

        // send user's ether
        const tx = formulasContract.methods.topUpEther()
        await account1.sendTransaction({to: formulasContract.address, value: preload, data: tx.encodeABI(), ...tmpGas}, prerequisities.servant.eth).getReceipt()
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), preload)

        // deposit extra eth
        const {contract: martyrContract, deployer: martyrDeployer} = await deployEtherMartyr(prerequisities, formulasContract.address, amount)
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), amount + preload)

        // try to withraw more than extra eth
        const response = await formulasContract.methods.withdrawDonations(0, account2.address, amount + 1, AddressZero).send({from: formulasDeployer}).getReceipt().catch(error => error)
        assert.isTrue(response instanceof Error)

        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'ether - failed', response.hashes[0])

        // check withdrawal failure
        assert.equal(await prerequisities.eth.getBalance(formulasContract.address), amount + preload)
        assert.equal(await prerequisities.eth.getBalance(account2.address), 0)
    })

    it('withdraw erc20', async () => {
        const amount = 100

        const account1 = Account.create()

        // deploy Crypto Formulas
        const {contract: formulasContract, deployer: formulasDeployer} = await deployFormulaDebugger(prerequisities)

        // deploy token contract
        const {contract: tokenContract, deployer: tokenDeployer} = await deployERC20(prerequisities)
        assert.equal(await tokenContract.methods.balanceOf(formulasContract.address).call(), 0)

        // send tokens to Crypto Formulas contract
        await tokenContract.methods.transfer(formulasContract.address, amount).send({from: tokenDeployer}).getReceipt()
        assert.equal(await tokenContract.methods.balanceOf(formulasContract.address).call(), amount)

        // withdraw tokens
        const response = await formulasContract.methods.withdrawDonations(1, account1.address, amount, tokenContract.address).send({from: formulasDeployer}).getReceipt().catch(error => error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'erc20', response.transactionHash)

        // check withdrawal success
        assert.equal(await tokenContract.methods.balanceOf(formulasContract.address).call(), 0)
        assert.equal(await tokenContract.methods.balanceOf(account1.address).call(), amount)
    })

    it('withdraw erc721', async () => {
        const tokenId = 1

        const account1 = Account.create()

        // deploy Crypto Formulas
        const {contract: formulasContract, deployer: formulasDeployer} = await deployFormulaDebugger(prerequisities)

        // deploy token contract
        const {contract: tokenContract, deployer: tokenDeployer} = await deployERC721(prerequisities)
        assert.equal((await tokenContract.methods.ownerOf(tokenId).call()).toString(), tokenDeployer.toString())

        // send tokens to Crypto Formulas contract
        await tokenContract.methods.transferFrom(tokenDeployer, formulasContract.address, tokenId).send({from: tokenDeployer}).getReceipt()
        assert.equal((await tokenContract.methods.ownerOf(tokenId).call()).toString(), formulasContract.address.toString())

        // withdraw tokens
        const response = await formulasContract.methods.withdrawDonations(2, account1.address, tokenId, tokenContract.address).send({from: formulasDeployer}).getReceipt().catch(error => error)
        await prerequisities.gasAnalytics.recordTransaction(gasLogNamespace, 'erc721', response.transactionHash)

        // check withdrawal success
        assert.equal((await tokenContract.methods.ownerOf(tokenId).call()).toString(), account1.address.toString())
    })
}
export default testDonationWithdrawal

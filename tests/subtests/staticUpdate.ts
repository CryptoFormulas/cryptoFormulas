import {assert} from 'chai'
import {testingTools} from 'soliditySapper'
import {AddressZero} from 'web3x/ethers/constants'


/**
    Deploy StaticUpdate contract.
*/
async function deployStaticUpdate(prerequisities: testingTools.IPrerequisities) {
    const deployer = (await prerequisities.servant.eth.getAccounts())[0]
    const {address, transactionHash} = await prerequisities.servant.easyDeploy('StaticUpdate:StaticUpdate', deployer)

    assert.notEqual(address, AddressZero)

    const contract = await prerequisities.servant.createContract('StaticUpdate:StaticUpdate', address)

    await prerequisities.gasAnalytics.recordTransaction('StaticUpdate', 'deploy', transactionHash)

    return {contract, deployer, address}
}

/**
    Ethereum gas logging adapted for StaticUpdate tests.
*/
async function gasLog(prerequisities, name, response): Promise<void> {
    const transactionHash = response.transactionHash || response.hashes[0]
    return prerequisities.gasAnalytics.recordTransaction('StaticUpdate', name, transactionHash)
}

// tests for StaticUpdate
const testStaticUpdate = (prerequisities: testingTools.IPrerequisities) => async () => {
    it('can be deployed', async () => {
        await deployStaticUpdate(prerequisities)
    })

    it('starts with all flags unset', async () => {
        const {contract} = await deployStaticUpdate(prerequisities)

        const nextVersion = await contract.methods.nextVersion().call()
        const newestVersion = await contract.methods.nextVersion().call()
        const securityHazard = await contract.methods.versionIsSecurityHazard().call()

        assert.equal(nextVersion, AddressZero)
        assert.equal(newestVersion, AddressZero)
        assert.isFalse(securityHazard)
    })

    it('can signal new version', async () => {
        const {contract, deployer} = await deployStaticUpdate(prerequisities)

        const nextAddress = deployer
        const securityHazard = true

        const response = await contract.methods.setNewVerion(nextAddress, securityHazard).send({from: deployer}).getReceipt()
        await gasLog(prerequisities, 'setNewVerion', response)
        assert.isOk(response)

        assert.equal((await contract.methods.nextVersion().call()).toString(), nextAddress.toString())
        assert.equal(await contract.methods.versionIsSecurityHazard().call(), securityHazard)
    })

    it('can be marked as security hazard', async () => {
        const {contract, deployer} = await deployStaticUpdate(prerequisities)

        const response = await contract.methods.markAsSecurityHazard().send({from: deployer}).getReceipt()
        await gasLog(prerequisities, 'markAsSecurityHazard', response)

        const isHazard = await contract.methods.versionIsSecurityHazard().call()
        assert.equal(isHazard, true)
    })

    it('can found the newest version in linked list', async () => {
        const {contract: contract1, deployer: deployer1} = await deployStaticUpdate(prerequisities)
        const {contract: contract2, deployer: deployer2} = await deployStaticUpdate(prerequisities)
        const {contract: contract3} = await deployStaticUpdate(prerequisities)

        // setup linked list
        const response1 = await contract1.methods.setNewVerion(contract2.address, false).send({from: deployer1}).getReceipt()
        await gasLog(prerequisities, 'setNewVerion', response1)
        const response2 = await contract2.methods.setNewVerion(contract3.address, false).send({from: deployer2}).getReceipt()
        await gasLog(prerequisities, 'setNewVerion', response2)

        // search for the newest version and check results
        const response3 = await contract1.methods.findTheNewestVersion().send({from: deployer1}).getReceipt()
        await gasLog(prerequisities, 'findTheNewestVersion', response3)

        const nextAddress1 = await contract1.methods.nextVersion().call()
        const nextAddress2 = await contract2.methods.nextVersion().call()
        const nextAddress3 = await contract3.methods.nextVersion().call()

        assert.equal(nextAddress1.toString(), contract2.address.toString())
        assert.equal(nextAddress2.toString(), contract3.address.toString())
        assert.equal(nextAddress3, AddressZero)

        const newestAddress1 = await contract1.methods.newestVersion().call()
        const newestAddress2 = await contract2.methods.newestVersion().call()
        const newestAddress3 = await contract3.methods.newestVersion().call()

        assert.equal(newestAddress1.toString(), contract3.address.toString())
        assert.equal(newestAddress2.toString(), contract3.address.toString())
        assert.equal(newestAddress3, AddressZero)
    })

    it('anyone can search for the newest version', async () => {
        const {contract: contract1, deployer: deployer1} = await deployStaticUpdate(prerequisities)
        const {contract: contract2, deployer: deployer2} = await deployStaticUpdate(prerequisities)
        const {contract: contract3} = await deployStaticUpdate(prerequisities)

        // setup linked list
        const response1 = await contract1.methods.setNewVerion(contract2.address, false).send({from: deployer1}).getReceipt()
        await gasLog(prerequisities, 'setNewVerion', response1)
        const response2 = await contract2.methods.setNewVerion(contract3.address, false).send({from: deployer2}).getReceipt()
        await gasLog(prerequisities, 'setNewVerion', response2)

        const accounts = await prerequisities.servant.eth.getAccounts()
        const randomAddress = accounts[1]

        // address that deployed contract is not owner of address that will search for the newestVersion
        assert.notEqual(randomAddress, deployer1)

        const response3 = await contract1.methods.findTheNewestVersion().send({from: deployer1}).getReceipt()
        await gasLog(prerequisities, 'findTheNewestVersion', response3)

        const newestAddress1 = await contract1.methods.newestVersion().call()
        assert.equal(newestAddress1.toString(), contract3.address.toString())
    })

    it('can have next version and security hazard set only by owner', async () => {
        const {contract, deployer} = await deployStaticUpdate(prerequisities)

        const accounts = await prerequisities.servant.eth.getAccounts()
        const randomAddress = accounts[1]

        const response1 = await contract.methods.setNewVerion(deployer, false).send({from: randomAddress}).getReceipt().catch(error => error)
        await gasLog(prerequisities, 'setNewVerion', response1)
        const response2 = await contract.methods.markAsSecurityHazard().send({from: randomAddress}).getReceipt().catch(error => error)
        await gasLog(prerequisities, 'markAsSecurityHazard', response2)

        const nextAddress = await contract.methods.nextVersion().call()
        const securityHazard = await contract.methods.versionIsSecurityHazard().call()

        assert.equal(nextAddress, AddressZero)
        assert.isFalse(securityHazard)
    })
}
export default testStaticUpdate

import {assert} from 'chai'
import {Account} from 'web3x/account'
import {Contract} from 'web3x/contract'
import {deployFormulas, deployERC20} from './formulaTest'
import {testingTools} from 'soliditySapper'
import {Formula} from '../../src/formula/Formula'
import {emptySignature} from '../../src/formula/IFormula'

const testFormulaClass = (prerequisities: testingTools.IPrerequisities) => () => {
    let token1Contract: Contract
    let contract: Contract

    beforeEach(async () => {
        ({contract} = await deployFormulas(prerequisities, true));
        ({contract: token1Contract} = await deployERC20(prerequisities))
    })

    it('calculates the same hash as contract does', async () => {
        const accounts = [Account.create(), Account.create()]
        const amountToken = 4500
        const amountEther = 123

        const formulaData = {
            endpoints: accounts.map(item => item.address),
            operations: [
                { // send token user1 -> user2
                    instruction: 1,
                    operands: [0, 1, amountToken, token1Contract.address]
                }, { // send ether user2 -> user1
                    instruction: 0,
                    operands: [1, 0, amountEther]
                }
            ]
        }

        const formula = new Formula(formulaData)
        const compiledFormula = formula.compile()

        const contractFormula = await contract.methods.decompileFormulaCompiled(compiledFormula).call()
        const messageHash = await contract.methods.calcFormulaHash(contractFormula).call()

        assert.equal(formula.messageHash, messageHash)
    })

    it('changing endpoint(s) doesn\'t change formula\'s hash', async () => {
        const accounts = [Account.create(), Account.create(), Account.create()]
        const amountToken = 4500
        const amountEther = 123

        const formulaData = {
            endpoints: accounts.slice(1).map(item => item.address),
            operations: [
                { // send token user1 -> user2
                    instruction: 1,
                    operands: [0, 1, amountToken, token1Contract.address]
                }, { // send ether user2 -> user1
                    instruction: 0,
                    operands: [1, 0, amountEther]
                }
            ]
        }

        const formula = new Formula(formulaData)

        assert.isFalse(accounts[0].address.equals(formula.endpoints[0])) // test integrity check
        const formulaNewEndpoint = new Formula({
            ...formula,
            endpoints: [accounts[0].address, ...formula.endpoints.slice(1)]
        })

        assert.equal(formulaNewEndpoint.messageHash, formula.messageHash)
        assert.equal(formulaNewEndpoint.compile(), formula.compile().replace(accounts[1].address.toString().slice(2), accounts[0].address.toString().slice(2)))

    })

    it('clone new', async () => {
        const accounts = [Account.create(), Account.create()]
        const amountToken = 4500
        const amountEther = 123

        const formulaData = {
            endpoints: accounts.map(item => item.address),
            operations: [
                { // send token user1 -> user2
                    instruction: 1,
                    operands: [0, 1, amountToken, token1Contract.address]
                }, { // send ether user2 -> user1
                    instruction: 0,
                    operands: [1, 0, amountEther]
                }
            ]
        }

        const formula = new Formula(formulaData)
        const clonedFormula = formula.cloneNew()

        const skip = ['messageHash', 'salt', 'signatures']
        assert.equal(Object.keys(clonedFormula).length, Object.keys(formula).length)
        Object.keys(formula)
            .filter(key => !skip.includes(key))
            .forEach(key => assert.deepEqual(clonedFormula[key], formula[key]))

        assert.notEqual(clonedFormula.salt, formula.salt)
        assert.notEqual(clonedFormula.messageHash, formula.messageHash)
        assert.deepEqual(clonedFormula.signatures, formula.signatures)
    })

    it('clone new has empty signatures', async () => {
        const accounts = [Account.create(), Account.create()]
        const amountToken = 4500
        const amountEther = 123

        const formulaData = {
            endpoints: accounts.map(item => item.address),
            operations: [
                { // send token user1 -> user2
                    instruction: 1,
                    operands: [0, 1, amountToken, token1Contract.address]
                }, { // send ether user2 -> user1
                    instruction: 0,
                    operands: [1, 0, amountEther]
                }
            ]
        }

        const unsignedFormula = new Formula(formulaData)
        const formula = new Formula({
            ...unsignedFormula,
            signatures: accounts.map(item => item.sign(unsignedFormula.messageHash).signature)
        })

        const clonedFormula = formula.cloneNew()

        assert.equal(formula.signatures.length, accounts.length)
        assert.equal(clonedFormula.signatures.length, 0)
    })

    it('isSigned returns proper value', async () => {
        const accounts = [Account.create(), Account.create()]
        const amountToken = 4500
        const amountEther = 123

        const formulaData = {
            endpoints: accounts.map(item => item.address),
            operations: [
                { // send token user1 -> user2
                    instruction: 1,
                    operands: [0, 1, amountToken, token1Contract.address]
                }, { // send ether user2 -> user1
                    instruction: 0,
                    operands: [1, 0, amountEther]
                }
            ]
        }

        const unsignedFormula = new Formula(formulaData)
        assert.isFalse(unsignedFormula.isSigned(0))
        assert.isFalse(unsignedFormula.isSigned(1))

        const signAccount = (item) => item.sign(unsignedFormula.messageHash).signature

        const partiallySignedFormula1 = new Formula({
            ...unsignedFormula,
            signatures: [
                emptySignature,
                signAccount(accounts[0])
            ]
        })
        assert.isFalse(partiallySignedFormula1.isSigned(0))
        assert.isTrue(partiallySignedFormula1.isSigned(1))

        const partiallySignedFormula2 = new Formula({
            ...unsignedFormula,
            signatures: [
                signAccount(accounts[0])
            ]
        })
        assert.isTrue(partiallySignedFormula2.isSigned(0))
        assert.isFalse(partiallySignedFormula2.isSigned(1))

        const formula = new Formula({
            ...unsignedFormula,
            signatures: accounts.map(signAccount)
        })
        assert.isTrue(formula.isSigned(0))
        assert.isTrue(formula.isSigned(1))
    })



    describe('Compilation', () => {
        it('compiles and decompiles formula core', async () => {
            const accounts = [Account.create(), Account.create()]
            const amountToken = 4500
            const amountEther = 123

            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    { // send token user1 -> user2
                        instruction: 1,
                        operands: [0, 1, amountToken, token1Contract.address]
                    }, { // send ether user2 -> user1
                        instruction: 0,
                        operands: [1, 0, amountEther]
                    }
                ]
            }

            const formula = new Formula(formulaData)
            const compiledFormula = formula.compile()
            assert.notEqual(JSON.stringify(compiledFormula), JSON.stringify(formula))

            const decompiledFormula = Formula.decompile(compiledFormula)
            assert.equal(JSON.stringify(decompiledFormula), JSON.stringify(formula))
        })

        it('compiles and decompiles formula with signatures', async () => {
            const accounts = [Account.create(), Account.create()]
            const amountToken = 4500
            const amountEther = 123

            const formulaData = {
                endpoints: accounts.map(item => item.address),
                operations: [
                    { // send token user1 -> user2
                        instruction: 1,
                        operands: [0, 1, amountToken, token1Contract.address]
                    }, { // send ether user2 -> user1
                        instruction: 0,
                        operands: [1, 0, amountEther]
                    }
                ]
            }

            const unsignedFormula = new Formula(formulaData)
            const signedFormula = new Formula({
                ...formulaData,
                signatures: accounts.map(item => item.sign(unsignedFormula.messageHash).signature)
            })

            const compiledFormula = signedFormula.compile()
            assert.notEqual(JSON.stringify(compiledFormula), JSON.stringify(signedFormula))
            const decompiledFormula = Formula.decompile(compiledFormula)
            assert.equal(JSON.stringify(decompiledFormula), JSON.stringify(signedFormula))
        })

        it('accepts endpoints as string', async () => {
            const accounts = [Account.create(), Account.create()]
            const amountToken = 4500
            const amountEther = 123

            const formulaData = {
                endpoints: accounts.map(item => item.address.toString()),
                operations: [
                    { // send token user1 -> user2
                        instruction: 1,
                        operands: [0, 1, amountToken, token1Contract.address]
                    }, { // send ether user2 -> user1
                        instruction: 0,
                        operands: [1, 0, amountEther]
                    }
                ]
            }

            const formula = new Formula(formulaData)
            const compiledFormula = formula.compile()

            assert.deepEqual(Formula.decompile(compiledFormula), formula)
        })
    })
}
export default testFormulaClass

import {IFormula, IFormulaData, IEndpoint, IEndpointData, IOperation, IOperationData, ICompiledFormula, emptySignature} from './IFormula'
import {encodePacked, encodeSingleValue, decodePacked, decodeSingleValue, ITypes, uint256HexLength, ITypeAlias} from './format'
import {instructionTypes} from './instructions'
import {Address} from 'web3x/address'
import * as keccak256 from 'keccak256'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {randomHex} from 'web3x/utils/hex'


// definitions of compiled data sizes
const sizes: {[key: string]: ITypes} = {
    salt: ITypes.uint256,
    arrayLength: ITypes.uint16,
    address: ITypes.address,
    pointer: ITypes.uint16,
    signature: ITypes.signature,
    instruction: ITypes.uint16,
}

/**
    Immutable representation of the Formula.
*/
export class Formula implements IFormula {
    public salt: BigNumber
    public signedEndpointCount: number
    public endpoints: IEndpoint[]
    public operations: IOperation[]
    public signatures: string[]
    public messageHash: string

    /**
        Constructor mainly sanitizes data and freezes the object.
    */
    public constructor(data: IFormulaData = {}) {
        this.salt = data.salt ? bigNumberify(data.salt) : this.generateSalt()
        this.endpoints = this.sanitizeEndpoints(data.endpoints || [])
        this.signedEndpointCount = data.signedEndpointCount || this.endpoints.length
        this.operations = this.sanitizeOperations(data.operations || [])
        this.signatures = this.sanitizeSignatures(data.signatures || [])

        if (this.signedEndpointCount > this.endpoints.length) {
            throw 'Invalid signedEndpointCount'
        }

        if (!this.validateOperationEndpoints()) {
            throw 'Invalid operations - using nonexisting endpoint'
        }

        this.messageHash = this.calcFormulaHash(this)

        Object.freeze(this) // make this object immutable
    }

    /**
        Generate new unique salt.
    */
    private generateSalt(): BigNumber {
        const number = bigNumberify(randomHex(uint256HexLength / 2))

        return number
    }

    /**
        Sanitize operation data possibly in raw or mixed format.
    */
    private sanitizeOperations(operations: IOperationData[]): IOperation[] {
        const sanitizeOperand = (operandType: ITypes, value: unknown) => {
            if (operandType == ITypes.address) {
                return value instanceof Address ? value : Address.fromString(value.toString())
            }

            const numericTypes = [ITypes.uint16, ITypes.uint32, ITypes.uint256, ITypes.endpoint, ITypes.signedEndpoint]
            if (numericTypes.includes(operandType)) {
                // it is importnat to cast the value to string before converting to BigNumber, otherwise inconsistency may occur
                // e.g. '0x01' vs '0x0001' - same number but different representation in JSON.stringify()

                return bigNumberify((<Object> value).toString())
            }

            throw `Invalid value for operand type '${operandType}'`
        }
        const sanitizeOperands = (instruction: BigNumber, operands: unknown[]) => {
            const parametersTypes = Formula.getInstructionOperandTypes(instruction)

            const results = parametersTypes.map((item, index) => sanitizeOperand(item, operands[index]))

            return results
        }
        const results = operations.map(item => {
            // it is importnat to cast the instruction to string before converting to BigNumber, otherwise inconsistency may occur
            // e.g. '0x01' vs '0x0001' - same number but different representation in JSON.stringify()
            const instruction = bigNumberify(item.instruction.toString())

            const instructionType = instructionTypes.find(item => instruction.eq(item.instructionCode))
            if (!instructionType) {
                throw `Invalid instruction '${item.instruction}'`
            }

            const newOperation = {
                instruction,
                operands: sanitizeOperands(instruction, item.operands)
            }

            return newOperation
        })

        return results
    }

    /**
        Sanitize endpoints data.
    */
    private sanitizeEndpoints(endpoints: IEndpointData[]): IEndpoint[] {
        const results = endpoints.length
            ? endpoints.map(item => typeof item == 'string' ? Address.fromString(item) : item)
            : [Address.ZERO] // each Formula must contain at least one endpoint

        return results
    }

    /**
        Sanitize signatures data.
    */
    private sanitizeSignatures(signatures: (string | null)[]): string[] {
        const results = signatures.map(item => item || emptySignature)

        // remove empty signatures from the end
        while (results.length && results[results.length - 1] == emptySignature) {
            results.pop()
        }

        return results
    }

    /**
        Checks that all endpoints used in operations are actually existing.
    */
    private validateOperationEndpoints(): boolean {
        const hasInvalidEndpoint = this.operations.some(operation => {
            const instructionType = instructionTypes.find(item => operation.instruction.eq(item.instructionCode))
            const parametersTypes = Formula.getInstructionOperandTypes(operation.instruction)

            const result = parametersTypes.some((item, index) => item == ITypes.endpoint && (operation.operands[index] as BigNumber).gte(this.endpoints.length))

            return result
        })

        return !hasInvalidEndpoint
    }

    /**
        Serializes the formula. This is inverse function to `Formula.decompile()`.
    */
    public compile(): string {
        const data = '0x'
            + encodeSingleValue(sizes.salt, this.salt)
            + encodeSingleValue(sizes.arrayLength, this.endpoints.length)
            + encodeSingleValue(sizes.arrayLength, this.signedEndpointCount)
            + this.endpoints.map(item => encodeSingleValue(sizes.address, item)).join('')
            + encodeSingleValue(sizes.arrayLength, this.operations.length)
            + this.operations.map(operation => {
                const parametersTypes = Formula.getInstructionOperandTypes(operation.instruction)

                const instruction = encodeSingleValue(sizes.pointer, operation.instruction)
                const operands = encodePacked(parametersTypes, operation.operands)

                return instruction + operands
            }).join('')
            + Array.from(Array(this.signedEndpointCount)).map((dummy, index) => {
                if (index >= this.signatures.length) {
                    return emptySignature.replace(/^0x/, '')
                }

                return encodeSingleValue(sizes.signature, this.signatures[index].replace(/^0x/, ''))
            }).join('')


        return data
    }

    /**
        Get operand types for the instruction.
    */
    private static getInstructionOperandTypes(instructionCode: BigNumber): ITypes[] {
        const instructionType = instructionTypes.find(item => instructionCode.eq(item.instructionCode))
        const parametersTypes = instructionType.format.map(item => item.type)

        return parametersTypes
    }

    /**
        Calculate hash for the formula. Endpoints and signatures values are not included in the hash.
    */
    private calcFormulaHash(data: IFormula): string {
        const toHash = this.calcMessageToHash(data)

        const hash = '0x' + keccak256(toHash).toString('hex')

        return hash
    }

    /**
        Composes string from Formula's data that can be used to calculate Formula's hash.
    */
    private calcMessageToHash(data: IFormula): string {
        const compiledFormula = this.compileData(data)
        const packedOperations = compiledFormula.operations
            .map(operation => encodePacked([sizes.instruction, ITypes.hexString], [operation.instruction, operation.operands]))
            .join('')

        const toHash = '0x'
            + encodeSingleValue(sizes.salt, compiledFormula.salt)
            + encodeSingleValue(sizes.arrayLength, compiledFormula.endpoints.length)
            + encodeSingleValue(sizes.arrayLength, compiledFormula.signedEndpointCount)
            + packedOperations
        const sanitizedToHash = toHash.toLowerCase()

        return sanitizedToHash
    }

    /**
        Compress data for the hashing.
    */
    private compileData(data: IFormula): ICompiledFormula {
        const operations = data.operations.map(rawOperation => {
            const parametersTypes = Formula.getInstructionOperandTypes(bigNumberify(rawOperation.instruction))
            const result = {
                instruction: encodeSingleValue(sizes.instruction, rawOperation.instruction),
                operands: '0x' + encodePacked(parametersTypes, rawOperation.operands)
            }

            return result
        })
        const result = {
            salt: data.salt,
            signedEndpointCount: data.signedEndpointCount,
            endpoints: data.endpoints,
            operations,
            signatures: data.signatures,
            messageHash: data.messageHash,
        }

        return result
    }

    /**
        Deserializes Formula. This is inverse function to `Formula.compile()`.
    */
    public static decompile(compiledFormula: string): IFormula {
        if (!compiledFormula.match(/0x([0-9a-f][0-9a-f])+/)) { // simple input validation
            throw 'Invalid compiled formula'
        }

        let remaining = compiledFormula.replace(/^0x/, '')
        let signedEndpointCount: number

        const decompileSalt = (): BigNumber => {
            const tmp = decodeSingleValue(sizes.salt, remaining)

            remaining = tmp[2]
            const salt = bigNumberify(<string> tmp[1])

            return salt
        }
        const decompileEndpoints = (): IEndpoint[] => {
            const results: IEndpoint[] = []

            const tmpCount = decodeSingleValue(sizes.arrayLength, remaining)
            const endpointCount = bigNumberify(<string> tmpCount[1]).toNumber()
            remaining = tmpCount[2]

            const tmpSignedCount = decodeSingleValue(sizes.arrayLength, remaining)
            signedEndpointCount = bigNumberify(<string> tmpSignedCount[1]).toNumber()
            remaining = tmpSignedCount[2]

            for (let i = 0; i < endpointCount; i++) {
                const [length, value] = decodeSingleValue(sizes.address, remaining)
                remaining = remaining.substr(length)
                results.push(<IEndpoint> value)
            }
            return results
        }
        const decompileOperations = (): IOperation[] => {
            const results = []

            const tmpLength = decodeSingleValue(sizes.arrayLength, remaining)
            const operationCount = bigNumberify(<string> tmpLength[1]).toNumber()
            remaining = tmpLength[2]

            for (let i = 0; i < operationCount; i++) {
                const [length1, instructionCode] = decodeSingleValue(sizes.instruction, remaining)
                remaining = remaining.substr(length1)
                const parametersTypes = Formula.getInstructionOperandTypes(<BigNumber> instructionCode)

                const [length2, operands] = decodePacked(parametersTypes, remaining)
                remaining = remaining.substr(length2)

                results.push({
                    instruction: instructionCode,
                    operands: operands
                })
            }

            return results
        }
        const decompileSignatures = (): string[] => {
            const results = []

            for (let i = 0; i < signedEndpointCount; i++) {
                const [length, signature] = decodeSingleValue(sizes.signature, remaining)
                remaining = remaining.substr(length)

                results.push('0x' + signature)
            }

            // remove empty signatures from the end
            while (results.length && results[results.length - 1] == emptySignature) {
                results.pop()
            }

            return results
        }

        // order of properties matters here due to calling of function sharing global variable `remaining`
        const formulaData = {
            salt: decompileSalt(),
            endpoints: decompileEndpoints(),
            signedEndpointCount,
            operations: decompileOperations(),
            signatures: decompileSignatures(),
        }

        if (!remaining.match(/0*/)) {
            throw new Error('Invalid compiled formula - extra suffix')
        }

        const formula = new Formula(formulaData)

        return formula
    }

    public getMessageToSign(endpointIndex: number): string {
        const messageToHash = '0x' + encodePacked([ITypes.uint256, ITypes.endpoint], [this.messageHash, endpointIndex])
        const result = '0x' + keccak256(messageToHash).toString('hex')

        return result
    }

    /**
        Creates copy of the Formula with unique salt (that resulting in different hash).
    */
    public cloneNew(): Formula {
        const {salt, signatures,  ...rest} = this
        const newFormula = new Formula({...rest})

        return newFormula
    }

    /**
        Check if endpoint is already signed.
    */
    public isSigned(endpointIndex: number): boolean {
        const result = !!(this.signatures[endpointIndex] && this.signatures[endpointIndex] != emptySignature)

        return result
    }
}

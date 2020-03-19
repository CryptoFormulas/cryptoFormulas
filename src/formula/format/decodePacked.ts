import {ITypes, signatureHexLength} from './formatConstants'
import {Address} from 'web3x/address'
import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'


/**
    Decode previously encoded values of known types from string. 
    "Almost-inverse" function to encodePacked().
*/
export function decodePacked(types: ITypes[], value: string): [number, unknown[], string] {
    const decodedValues = []

    let remains = value.replace(/^0x/, '')
    let sizeUsed = 0
    for (let i = 0; i < types.length; i++) {
        if (!remains.length) {
            throw 'Invalid value and types combination'
        }

        const [size, tmp] = decodeSingleValue(types[i], remains)
        decodedValues.push(tmp)
        remains = remains.substring(size)
        sizeUsed += size
    }

    return [sizeUsed, decodedValues, value.substr(sizeUsed)]
}

/**
    Decode one previously encoded value of known type.
    "Almost-inverse" function to encodeSingleValue().
*/
export function decodeSingleValue(type: ITypes, value: string): [number, unknown, string] {
    if (type == ITypes.address) {
        return decodeGeneric(40, value, (item) => Address.fromString('0x' + <string> item))
    }

    if (type == ITypes.endpoint || type == ITypes.signedEndpoint) {
        return decodeNumber(4, value)
    }

    if (type == ITypes.uint16) {
        return decodeNumber(4, value)
    }

    if (type == ITypes.uint32) {
        return decodeNumber(8, value)
    }

    if (type == ITypes.uint256) {
        return decodeNumber(64, value)
    }

    if (type == ITypes.hexString) {
        return [value.length, value, '']
    }

    if (type == ITypes.bytes) {
        const [characterCount, bytesLength, remaining] = decodeSingleValue(ITypes.uint256, value)
        const bytesLengthNumber = (<BigNumber> bytesLength).mul(2).toNumber()

        return [characterCount + bytesLengthNumber, remaining.substr(0, bytesLengthNumber), remaining.substr(bytesLengthNumber)]
    }

    if (type == ITypes.signature) {
        return decodeGeneric(signatureHexLength, value)
    }

    throw `Invalid type '${type}'`
}

/**
    Decode number of given length from string.
*/
function decodeNumber(length: number, value: string) {
    return decodeGeneric(length, value, (item) => bigNumberify('0x' + item))
}

/**
    Decode generic value of given length from string.
*/
function decodeGeneric(length: number, value: string, decorator?: (decodedValue: string) => unknown): [number, unknown, string] {
    const realDecorator = decorator || ((item) => item)

    return [length, realDecorator(value.substr(0, length)), value.substr(length)]
}

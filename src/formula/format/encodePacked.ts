import {BigNumber, bigNumberify} from 'web3x/ethers/bignumber'
import {ITypes, signatureHexLength, uint256HexLength, addressHexLength} from './formatConstants'


/**
    Encode values to numeric representation of minimal length for the respective type.
    "Almost-inverse" function to decodePacked().
*/
export function encodePacked(types: ITypes[], values: unknown[]): string {
    if (types.length != values.length) {
        throw 'Invalid types/values arrays length'
    }

    const encodedValues = types.map((type, index) => encodeSingleValue(type, values[index]))
    const result = encodedValues.join('')

    return result
}

/**
    Encode value to numeric representation of minimal length for the given type.
    "Almost-inverse" function to decodeSingleValue().
*/
export function encodeSingleValue(type: ITypes, value: unknown): string {
    if (type == ITypes.address) {
        return encodeAddress((<any> value).toString())
    }

    if (type == ITypes.endpoint || type == ITypes.signedEndpoint) {
        return encodeSingleValue(ITypes.uint16, value)
    }

    if (type == ITypes.uint16) {
        const uint256 = encodeUint256(bigNumberify(<any> value))

        return uint256.substr(-4)
    }

    if (type == ITypes.uint32) {
        const uint256 = encodeUint256(bigNumberify(<any> value))

        return uint256.substr(-8)
    }

    if (type == ITypes.uint256) {
        return encodeUint256(bigNumberify(<any> value))
    }

    if (type == ITypes.hexString) {
        return (<string> value).replace(/^0x/, '')
    }

    if (type == ITypes.bytes) {
        const tmp = (<string> value).replace(/^0x/, '')
        return ''
            + encodeSingleValue(ITypes.uint256, tmp.length)
            + tmp
    }

    if (type == ITypes.signature) {
        const tmp = (<string> value).replace(/^0x/, '')
        if (tmp.length != signatureHexLength) {
            throw 'Invalid signature length'
        }

        return tmp
    }

    throw `Invalid type '${type}'`
}

/**
    Encode address.
*/
function encodeAddress(address: string): string {
    //if (address.length != AddressZero.length) {
    if (!address.match(new RegExp(`^0x[0-9a-fA-F]{${addressHexLength}}`))) {
        throw `Invalid address '${address}'`
    }

    return address.replace(/^0x/, '')
}

/**
    Encode number to hex as uint256.
*/
function encodeUint256(value: BigNumber): string {
    return ('0'.repeat(uint256HexLength) + value.toHexString().replace(/^0x/, '')).substr(-uint256HexLength)
}

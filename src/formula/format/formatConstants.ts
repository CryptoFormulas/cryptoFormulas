export const uint256HexLength = 64 // 32 bytes
export const signatureHexLength = 130 // 65 bytes
export const addressHexLength = 40 // 20 bytes

/**
    Types of values represented in Formula.
*/
export enum ITypes {
    endpoint = 'endpoint',
    signedEndpoint = 'signedEndpoint',
    address = 'address',
    uint16 = 'uint16',
    uint32 = 'uint32',
    uint256 = 'uint256',
    boolean = 'boolean',
    hexString = 'hexString',
    bytes = 'bytes',
    signature = 'signature'
}

/**
    More expressive types that ITypes that can be used to show proper input type in GUI, etc.
*/
export enum ITypeAlias {
    blockNumber = 'blockNumber',
    etherAmount = 'etherAmount',
    tokenAmount = 'tokenAmount',
    etherFeeAmount = 'etherFeeAmount',
    tokenId = 'tokenId',
    erc20Address = 'erc20Address',
    erc721Address = 'erc721Address'
}

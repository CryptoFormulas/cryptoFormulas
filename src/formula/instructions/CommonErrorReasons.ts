/**
    Common reasons of problem with Formula execution shared by multiple instructions.
*/
export enum CommonErrorReasons {
    noError = '',

    senderEmpty = 'senderEmpty', // sender endpoint is empty
    targetEmpty = 'targetEmpty', // target endpoint is empty
    insufficientEtherInternal = 'insufficientEtherInternal', // endpoint has insufficient ether balance at Crypto Formulas contract
    tokenEmpty = 'tokenEmpty', // token address is empty
    noContractAtTokenAddress = 'noContractAtTokenAddress', // no contract found at token contract address
    senderIsTarget = 'senderIsTarget', // sender and target are the same in send-from-to transaction
    targetIsContract = 'targetIsContract' // target is contract and it will likely incorrectly add balance
}

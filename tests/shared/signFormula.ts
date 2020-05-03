import {IFormula} from '../../src/formula/IFormula'
import {Signature} from 'web3x/utils/sign'
import {Account} from 'web3x/account'
import {Address} from 'web3x/address'
import {Eth} from 'web3x/eth'


export function signFormulaEndpoint(formula: IFormula, account: Account, endpointIndex: number): Signature {
    const messageToSign = formula.getMessageToSign(endpointIndex)
    const result = account.sign(messageToSign)

    return result
}

export async function requestFormulaEndpointSign(eth: Eth, formula: IFormula, signer: Address, endpointIndex: number): Promise<string> {
    const messageToSign = formula.getMessageToSign(endpointIndex)
    const result = await eth.sign(signer, messageToSign)

    return result
}

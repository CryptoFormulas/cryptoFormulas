import './FormulaDefiner.sol';

// transport adapters must be implemented as contracts (instead of libraries)
// so they support member properties (that's the cause of weird naming prefixes)
import './transferAdapters/ERC20.sol';
import './transferAdapters/ERC721.sol';
import './transferAdapters/Ether.sol';


/**
    Contract resolving Formula.
*/
contract FormulaResolver is FormulaDefiner, Constants, FormulasAdapter_Ether, FormulasAdapter_ERC721, FormulasAdapter_ERC20 {

    event FormulasResolver_feePaid(address payer, uint256 amount);

    /**
        Resolve Formula.
    */
    function resolveFormula(Formula memory formulaInfo) internal {
        for (uint256 i = 0; i < formulaInfo.operations.length; i++) {
            resolveOperation(formulaInfo, formulaInfo.operations[i], formulaInfo.endpoints, formulaInfo.signedEndpointCount);
        }
    }

    /**
        Resolves a single operation.
    */
    function resolveOperation(Formula memory formulaInfo, Operation memory operation, address[] memory endpoints, uint256 signedEndpointCount) internal {
        // instruction send ether (inside this contract)
        if (operation.instruction == 0) {
            (uint16 fromIndex, uint16 to, uint256 amount) = extractGenericEtherParams(operation, endpoints.length, signedEndpointCount);

            ether_transferValueInside(endpoints[fromIndex], endpoints[to], amount);
            return;
        }

        // instruction send fungible tokens
        if (operation.instruction == 1) {
            (uint16 fromIndex, uint16 to, uint256 amount, address token) = extractGenericTokenParams(operation, endpoints.length, signedEndpointCount);

            erc20_transferValue(token, endpoints[fromIndex], endpoints[to], amount);
            return;
        }

        // instruction send (one) nonfungible token
        if (operation.instruction == 2) {
            (uint16 fromIndex, uint16 to, uint256 tokenId, address token) = extractGenericTokenParams(operation, endpoints.length, signedEndpointCount);

            erc721_transferValue(token, endpoints[fromIndex], endpoints[to], tokenId);
            return;
        }

        // instruction withdraw ether
        if (operation.instruction == 3) {
            (uint16 fromIndex, uint16 to, uint256 amount) = extractGenericEtherParams(operation, endpoints.length, signedEndpointCount);

            ether_transferValue(endpoints[fromIndex], payable(endpoints[to]), amount);
            return;
        }

        // instruction pay fee
        if (operation.instruction == 4) {
            uint256 shiftFromIndex = sizePointer;
            uint256 shiftAmount = sizePointer + sizeAmount;

            bytes memory operandsPointer = operation.operands;
            uint16 fromIndex;
            uint256 amount;
            assembly {
                fromIndex := mload(add(operandsPointer, shiftFromIndex))
                amount := mload(add(operandsPointer, shiftAmount))
            }

            // pay fee of `formulaFee` * `operation count` (including this fee operation)
            require(amount >= formulaInfo.operations.length * formulaFee, 'Fee amount is too small.');

            ether_transferValueInside(endpoints[fromIndex], payable(address(this)), amount);
            emit FormulasResolver_feePaid(endpoints[fromIndex], amount);

            return;
        }

        // instruction time condition
        if (operation.instruction == 5) {
            uint256 shiftMinimum = sizeBlockNumber;
            uint256 shiftMaximum = sizeBlockNumber + sizeBlockNumber;

            bytes memory operandsPointer = operation.operands;
            uint32 minimumBlockNumber;
            uint32 maximumBlockNumber;

            assembly {
                minimumBlockNumber := mload(add(operandsPointer, shiftMinimum))
                maximumBlockNumber := mload(add(operandsPointer, shiftMaximum))
            }

            require(minimumBlockNumber == 0 || minimumBlockNumber <= block.number, 'Minimum block number not reached yet.');
            require(maximumBlockNumber == 0 || maximumBlockNumber >= block.number, 'Formula validity already expired.');
            return;
        }

        revert('Invalid operation');
    }

    /**
        Loads operands for generic operation that sends ether.
    */
    function extractGenericEtherParams(Operation memory operation, uint256 endpointCount, uint256 signedEndpointCount) internal pure returns (uint16 fromIndex, uint16 to, uint256 amount) {
        bytes memory operandsPointer = operation.operands;

        uint256 shiftFromIndex = sizePointer;
        uint256 shiftTo = sizePointer + sizePointer;
        uint256 shiftAmount = sizePointer + sizePointer + sizeAmount;
        assembly {
            fromIndex := mload(add(operandsPointer, shiftFromIndex))
            to := mload(add(operandsPointer, shiftTo))
            amount := mload(add(operandsPointer, shiftAmount))
        }

        require(fromIndex < signedEndpointCount, 'Invalid signed endpoint pointer.');
        require(to < endpointCount, 'Invalid endpoint pointer.');
    }

    /**
        Loads operands for generic operation that sends ether.
    */
    function extractGenericTokenParams(Operation memory operation, uint256 endpointCount, uint256 signedEndpointCount) internal pure returns (uint16 fromIndex, uint16 to, uint256 amountOrId, address token) {
        bytes memory operandsPointer = operation.operands;

        uint256 shiftFromIndex = sizePointer;
        uint256 shiftTo = sizePointer + sizePointer;
        uint256 shiftAmount = sizePointer + sizePointer + sizeAmount;
        uint256 shiftToken = sizePointer + sizePointer + sizeWord + sizeAddress;
        assembly {
            fromIndex := mload(add(operandsPointer, shiftFromIndex))
            to := mload(add(operandsPointer, shiftTo))
            amountOrId := mload(add(operandsPointer, shiftAmount))
            token := mload(add(operandsPointer, shiftToken))
        }

        require(fromIndex < signedEndpointCount, 'Invalid signed endpoint pointer.');
        require(to < endpointCount, 'Invalid endpoint pointer.');
    }
}

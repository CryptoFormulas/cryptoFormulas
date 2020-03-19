pragma solidity ^0.6.0;

library SignatureVerifier {

    function verifySignaturePrefixed(address signer, bytes32 messageHash, bytes memory signature) internal pure returns (bool) {
        (uint8 v, bytes32 r, bytes32 s) = signatureParts(signature);

        return verifySignaturePrefixed(signer, messageHash, v, r, s);
    }

    function verifySignature(address signer, bytes32 messageHash, bytes memory signature) internal pure returns (bool) {
        (uint8 v, bytes32 r, bytes32 s) = signatureParts(signature);

        return verifySignature(signer, messageHash, v, r, s);
    }

    function verifySignaturePrefixed(address signer, bytes32 messageHash, uint8 v, bytes32 r, bytes32 s) internal pure returns (bool) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, messageHash));

        return addressFromSignature(prefixedHash, v, r, s) == signer;
    }

    function verifySignature(address signer, bytes32 messageHash, uint8 v, bytes32 r, bytes32 s) internal pure returns (bool) {
        bytes32 prefixedHash = keccak256(abi.encodePacked(messageHash));

        return addressFromSignature(prefixedHash, v, r, s) == signer;
    }

    // `messageHash == keccak256(signedMessage)`
    function addressFromSignature(bytes32 messageHash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        address signer = ecrecover(messageHash, v, r, s);

        return signer;
    }

    function signatureParts(bytes memory signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) {
            v += 27;
        }

        // sanity check
        if (v != 27 && v != 28) {
            revert('Invalid signature');
        }

        return (v, r, s);
    }
}

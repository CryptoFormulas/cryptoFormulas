pragma solidity ^0.6.0;

import './interfaces/Ownable.sol';

/*
    StaticUpdate contract creates linked list of different versions of application contract.
    Application contracts' logic is meant to be immutable, meaning that user's funds can't be stolen
    via changing logic of already deployed contract (unlike in popular `proxy pattern` versioning).
    With this pattern creator can upgrade contract while users can choose if they want to use new contract
    or keep using the older version.
*/
contract StaticUpdate is Ownable {

    event StaticUpdate_NewVersion(address newVersion);
    event StaticUpdate_SecurityHazard();

    address public nextVersion;
    address public newestVersion;
    bool public versionIsSecurityHazard;

    constructor() Ownable() public {

    }

    /**
        Set (new) next version of this contract.

        Optionally you can mark current version (this contract) as security hazard.
        Telling everybody to be cautios when interacting with this contract (or rather not interact with it at all).
    */
    function setNewVerion(address newVersion, bool securityHazard) external onlyOwner {
        require(nextVersion == address(0), 'New version already set.'); // prevent this function from being called repeatedly

        nextVersion = newVersion;
        newestVersion = newVersion;

        emit StaticUpdate_NewVersion(newVersion);

        if (securityHazard) {
            markAsSecurityHazard();
        }
    }

    /**
        Mark current version (this contract) as security hazard.
        Telling everybody to be cautios when interacting with this contract (or rather not interact with it at all).
    */
    function markAsSecurityHazard() public onlyOwner {
        versionIsSecurityHazard = true;
        emit StaticUpdate_SecurityHazard();
    }

    /**
        Updates pointer to the newest item in the linked list of contract versions.

        Anybody can use this function.
    */
    function findTheNewestVersion() external returns (address) {
        if (newestVersion == address(0)) {
            return address(this);
        }

        newestVersion = StaticUpdate(newestVersion).findTheNewestVersion();
        return newestVersion;
    }
}

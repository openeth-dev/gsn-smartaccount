package com.tabookey.safechannels.addressbook

import com.tabookey.safechannels.vault.VaultStorageInterface

/**
 * All entities in the [AddressBook] are [SafechannelContact] instances.
 */
class AddressBook(private val storage: VaultStorageInterface) {

    fun getAllEntities(): List<SafechannelContact> {
        return storage.getAddressBookEntries()
    }

    // Will we need a better, dynamic filtering here?
    fun getAllKnownERC20Tokens(): List<ERC20Token> {
        TODO()
    }

    fun getAllKnownERC721Tokens(): List<EthereumAddress> { // As an example, not supported now by solidity
        TODO()
    }

    fun addNewContact(
            contact: SafechannelContact
    ) {
        // TODO: I cannot be the first one ever to do something like that, what is the pattern to assign ID to the new object? Thx!
        storage.putAddressBookEntry(contact)
        return
    }

    fun deleteEntry(entry: SafechannelContact) {

    }

    fun editEntry(): SafechannelContact {
        TODO()
    }


}
package com.tabookey.safechannels.addressbook

import com.tabookey.safechannels.vault.VaultStorageInterface

class AddressBook(private val storage: VaultStorageInterface) {

    fun getAllKnownAddresses(): List<AddressBookEntry> {
        return storage.getAddressBookEntries()
    }

    fun getAllKnownPeople(): List<PhoneBookContact> {
        val allAddresses = storage.getAddressBookEntries()
        return allAddresses
                .filter {
                    it.contactType == AddressBookEntry.AddressContactType.EOA
                }
                .map {
                    // TODO: like, the idea is that I will read the contacts and its metadata (like contact info) separately. Does it make sense?
                    val contactInfo = emptyList<String>()
                    PhoneBookContact(it, contactInfo)
                }.toList()
    }

    // Will we need a better, dynamic filtering here?
    fun getAllKnownERC20Tokens(): List<ERC20Token> {
        TODO()
    }

    fun getAllKnownERC721Tokens(): List<AddressBookEntry> { // As an example, not supported now by solidity
        TODO()
    }

    fun saveNewAddress(
            displayName: String,
            ethAddress: String,
            contactType: AddressBookEntry.AddressContactType): AddressBookEntry {
        val entry = PhoneBookContact(null, ethAddress, displayName, emptyList())
        // TODO: I cannot be the first one ever to do something like that, what is the pattern to assign ID to the new object? Thx!
        entry.id = storage.putAddressBookEntry(entry)
        return entry
    }

    fun deleteEntry(entry: AddressBookEntry) {

    }

    fun editEntry(): AddressBookEntry {
        TODO()
    }


}
package com.tabookey.safechannels.addressbook

class AddressBook {

    fun getAllKnownAddresses(): List<AddressBookEntry> {
        TODO()
    }

    fun getAllKnownPeople(): List<PhoneBookContact> {
        TODO()
    }

    // Will we need a better, dynamic filtering here?
    fun getAllKnownERC20Tokens(): List<ERC20Token> {
        TODO()
    }

    fun getAllKnownERC721Tokens(): List<AddressBookEntry> { // As an example, not supported now by solidity
        TODO()
    }

    fun saveNewAddress(): AddressBookEntry {
        TODO()
    }

    fun deleteEntry(entry: AddressBookEntry) {

    }

    fun editEntry(): AddressBookEntry {
        TODO()
    }


}
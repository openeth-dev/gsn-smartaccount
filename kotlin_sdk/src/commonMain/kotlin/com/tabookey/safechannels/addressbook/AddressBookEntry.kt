package com.tabookey.safechannels.addressbook

open class AddressBookEntry(
        var id: Int?,
        val address: String,
        val name: String,
        val contactType: AddressContactType
){
    /**
     * These should be represented by different classes, but the base data class should hold
     * the info of what is behind that address. This is what will be stored in a database.
     * Concrete instances of [ERC20Token], [PhoneBookContact] etc. will be constructed based
     * on this field.
     */
    enum class AddressContactType{
        EOA,
        PAYABLE_CONTRACT, // Like vault, multisig, identity or proxy. Note that transfers to this may cost more gas, have side effects etc. SDK should know that
        ERC20, // So that we do not transfer money to non-payable contracts, will either revert or lose funds
        ERC721,
//        ...
    }
}



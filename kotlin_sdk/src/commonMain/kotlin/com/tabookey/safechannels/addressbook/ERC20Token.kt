package com.tabookey.safechannels.addressbook

class ERC20Token(
        id: Int?,
        address: String,
        name: String,
        val decimals: Int,
        val symbol: String) : AddressBookEntry(id, address, name, AddressContactType.ERC20)

package com.tabookey.safechannels.addressbook

class PhoneBookContact(
        id: Int?,
        address: String,
        name: String,
        // TBD. This is really platform-specific, but I expect this to be an
        // integral part of our proof-of-intent approach so I think we should put this in the SDK
        val contactInfo: List<String>
) : AddressBookEntry(id, address, name)
package com.tabookey.safechannels.addressbook

import com.tabookey.duplicated.VaultParticipant
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


    fun recognizeParticipant(vaultId: Int, participantHash: String): Pair<VaultParticipant?, String> {
        val participantsMatched = storage.getAddressBookEntries()
                .mapNotNull { it.participantTuples[vaultId] } // Take contacts with roles in this vault
                .mapNotNull { list ->
                    val matchedParticipant = list.find {
                        it.participantHash == participantHash
                    }
                    matchedParticipant
                }
        return when {
            participantsMatched.size == 1 -> Pair(participantsMatched[0], participantHash)
            participantsMatched.size > 1 -> {
                // TODO:
                println("MULTIPLE CONTACTS WITH SAME PARTICIPANT")
                Pair(participantsMatched[0], participantHash)
            }
            else -> Pair(null, participantHash)
        }
    }


}
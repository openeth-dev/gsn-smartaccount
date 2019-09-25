package com.tabookey.duplicated

interface IKredentials {
    fun getAddress(): EthereumAddress
    fun sign() {
/*
        I want the signing to be asynchronous, so it is either a) modifying the entire Web3J Tx Manager,
        or b) in case user interaction is needed, block the worker thread like that:
        if (thread is main){
            throw "Come back in a different thread, punk!"
        }
        lock()
        RunOnUIThread(){
            ShowPopup(){
                onConfirm(){
                    unlock()
                }
                onReject(){
                    throw "Not on my watch!"
            }
        }
 */
    }
}
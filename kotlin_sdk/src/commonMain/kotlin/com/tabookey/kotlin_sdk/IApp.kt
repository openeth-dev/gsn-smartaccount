package com.tabookey.kotlin_sdk

expect interface IApp {

    fun emitMessageWrapped(message: String, value: Int): Receipt

    fun getData(): Any

    fun foo(value: Int)
}


class Receipt {
    var block: Int? = null
    var message: String? = null
    var value: Int? = null
}
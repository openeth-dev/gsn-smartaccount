package com.tabookey.jsfoundation

@JsModule("../../src/index.js")
external class App : IApp {

    constructor(contractAddress: String, fromAddress: String)

    override fun emitMessageWrapped(message: String, value: Int): Promise<Receipt>

    override fun getData(): Any

    override fun foo(value: Int)

    // etc
}
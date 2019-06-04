package com.tabookey.kotlin_sdk

class Sdk(val app: IApp) {

    fun doStuff() {
        app.emitMessageWrapped("Hello", 7)
    }
}
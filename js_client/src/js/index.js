kotlin = require('kotlin')
// kotlin = require('./kotlin.js')
// const KotlinSdk = require("../../../kotlin_sdk/build/classes/kotlin/js/main/kotlin_sdk");
const KotlinSdk = require("./kotlin_sdk");
const Interactor = require("../../../js_foundation/src/js/VaultContractInteractor");

const Web3 = require('web3');

class Application {
    async main() {
        let ethNodeUrl = 'http://localhost:8545';
        let provider = new Web3.providers.HttpProvider(ethNodeUrl);
        let web3 = new Web3(provider);
        let interactor = new Interactor(web3);//web3, account, permissions, level, gatekeeper, vault, vaultFactory) {
        let interactorWrapped = KotlinSdk.com.tabookey.kotlin_sdk.wrap_c8t7sw$(interactor);
        let kotlinSdk = new KotlinSdk.com.tabookey.kotlin_sdk.Sdk(interactorWrapped);
        console.log("AAAA")
        let receipt = kotlinSdk.getOperatorBlaBla((str) => {
            console.log(str)
        });
        console.log("BBB")
        console.log(receipt);
    }
}

console.log(KotlinSdk.sample.hello());
let a = new Application();
a.main();
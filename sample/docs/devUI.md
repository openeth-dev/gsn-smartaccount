# Dev UI of SmartAccount

This project provides a "SampleWallet" application above the SmartAccount framework.
Note that currently the borders betweent the "Sample" and "framework" 
are a bit blurred.

Some of the functionality is still implemented in the App, and should be moved into the "SDK"

## Starting the environment:

```
yarn testserver
```

Bring up the complete "server suite": ganache, GSN (hub, relay)
backend (web, guardian)

The ports are hard-coded to 8090 (relay), 8888 (webserver), 8545 (ganache)

You can bring up the environment with external ganache instance with:
`yarn justtestserver`

to start just ganache use `yarn ganache`

```
yarn react-start
```

Startup react frontenv app on `localhost:3000`.

You can connect to this host from another computer (or mobile), but it still assumes
that ganache and the webserver are running on the same host.


## Using the UI
- at the top, there is 'Debug State' checkbox. it shows the complete react `state` as json tree. All the UI is based on this state.
- DEBUG buttons
- red error message - last operation failed. click message to dismiss.
- **Signout** - disconnect everythning. forgets private-key, google auth login, app approval
 
- **Button: Must first connect app** - this enables our app (localhost:3000) with the wallet iframe (localhost:3000/account.html)
  if you don't click it, the `login` will fail (currently, only dumps to console log) 
  
- **login** - perform google login. 

### After login:
- **verify phone** - enter phone for sms. "1" will put in a valid phone..
- open the **testserver** console, and copy the SMS code
- click **verify** and enter code.

## Active Wallet
- click `fund` button to have some eth (can also send using `truffle console`)
- **Balances** show all (currently, only ETH) balances
- Button `send ETH`: enter valid dest addr and eth value (in eth, not GWEI)
- opens "Pending" list, with a "Cancel" button (pending is also dumped as json)
- default delay 48 days (level 1)
- click `DEBUG: increaseTime` to advance a day. 
  after 2 clicks, pending transaction will be applied (if balance was enough)

## Simulate another app:
- open http://localhost:3000/something. it will open the same app, but with different app URL (though same iframe)
- you only need to click `approve`, and the "new app" will connect to the iframe and show the wallet.

## recover
- click "signout", to forget the privatekey, etc.
- after re `approve app`, the wallet is detect but with different owner, so an option to recover/add device is given.

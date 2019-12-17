# Sample App Flows

## Components

* **User:** end-user, that runs a browser, and can accept SMS (and click links)
* **webapp:** static web-page of the application. communicate with the BE and with
   the vault (through gsn)
   contains the "account iframe", described below.
* **be**: back-end server: this is actually 2 separate components:
  * **guardian**: listen to ethereum events, and acts
  * **be**: listen to http requests from client, and pass requests to the guardian.<br>
  can be separated into 2 separate entities, but not in the demo..
* **account frame:** inside the static webapp, there's a small iframe which does:
  * google oauth.
  * creates private key and address. keep in `localStorage`
  * exposed APIs:
    * **getToken(nonce)** - returns a fresh JWT (token, email). prompt user if not logged in.
    * **getAddress()** - return address
    * **createAccount()** - authenticate and create address,privkey
    * **sign(data)** - use privkey to sign data
* **sponsor**:
  - accepts calls to `factory`, with a signed approval from BE (jwt is fresh)
  - accepst calls to existing vault, from `isParticipant`<br>
    **TBD:** charge vault for such operations.
* **factory**: create and do initial configuration for a vault. Called through sponsor.
* **vault**: a single vault (safechannel)

### backend

* node module (so it can be used easily during testing)
* local DB to map vaultAddr-phone-email<br>
  (email can be deferred from approvaldata, but we have storage anyway.)
* SMS links:
  * we must use short SMS links, so BE genrates "short urls": links with random key
    into local storage.

## Flows:

- [Create Vault](#createVault)
- [Add Device Immediate](#addDeviceImmediate)
- [Recover Device](#recoverDevice)
- [Transfer](#transfer)
- [Transfer Immediate](#transferImmediate)
- [Add to Whitelist](#addToWhitelist)
- [Remove from Whitelist](#removeFromWhitelist)


- **Technical flow:** using Google Auth in iFrame

<a name="createVault"></a>
### Vault Creation

![Vault Creation](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Vault+Creation%0a%0aparticipant+user%0aparticipant+webapp+as+app%0aparticipant+iframe%0aparticipant+google%0aparticipant+%22Backend%22+as+be%0aparticipant+Sponsor%5cn%28Via+GSN%29+as+sponsor%0aparticipant+factory%0aparticipant+vault%0auser-%3e%2bapp%3a+googleLogin%28%29%0aapp-%3e%2biframe%3a+googleLogin%28%29%0aiframe-%3egoogle%3a+gapi%2esignIn%28%29%0anote+over+google%3a+Prompt+User+to%5cnselect+Account%0agoogle--%3eiframe%3a+JWT%28email%29%0aiframe--%3e-app%3a+JWT%0aapp-%3e-user%3a+JWT%0anote+over+user%3a+prompt+for+phone%0auser-%3e%2bapp%3a+validatePhone%28jwt%2c+phone%29%0aapp-%3e%2bbe%3avalidatePhone%28jwt%2c+phone%29%0anote+over+user%3a+wait+for+sms%0adeactivate+app%0abe-%3e-user%3a+SMS+click+here+%28smsUrl-verifyCode%29%0auser-%3e%2bapp%3a+createWallet%28%7bsms-verifyCode%7d%29%0anote+over+app%3a+create%5cnaddress%2cPK%5cnsave+in+LocalStorage%0aapp-%3egoogle%3a+gapi%2eauthenticate%28email%2c+nonce%3aaddress%29%0agoogle--%3eapp%3a+JWT%28email%2cnonce%3aaddress%29%0aapp-%3e%2bbe%3acreateAccount%28JWT%2c+smsVerifyCode%29%0anote+over+be%0avalidate+JWT%2c%0asave+email%2cphone%2c%0aparse+JWT%2c%0asalt%3dhash%28email%29%0asig+%3d+ecdsaSign%28salt%2ctimestamp%29%0aend+note%0abe--%3e-app%3a+approvalData%28salt%2ctimestamp%2csig%29%0aapp-%3esponsor%3a+createVault%28salt%2c+%7b+approvalData%3a%7btimestamp+%7c%7c+sig+%7d%7d+%29%0aactivate+sponsor%0anote+over+sponsor%3a+validate+backend-sig%5cnon+salt%2ctimestamp%0asponsor-%3e-factory%3a+createVault%0aactivate+factory%0afactory-%3evault%3a+create2%0afactory-%3evault%3a+configure%0adeactivate+factory%0avault--%3e-webapp%3a+monitor+changes)


<a name="addDeviceImmediate" ></a>
### Add Device Immediate

- Add new device.
- SMS is used to pass new device info (address, title) to old device.
- SMS **must** also be used as 2FA authentication: guardian should approve only
    if it can verify SMS was used.

![Add Device Immediate](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Add+Device+Immediate%0a%0aparticipant+%22NewDevice%22+as+new%0aparticipant+%22OldDevice%22+as+user%0aparticipant+webapp+as+app%0aparticipant+%22Backend%22+as+be%0aparticipant+vault%0aparticipant+google%0a%0anew-%3e%2bapp%3a+login%0aactivate+new%0aapp-%3egoogle%3a+authenticate%28email%2c+nonce%28newaddr%29%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e-be%3aaddDeviceNow%28jwt%2c+title%29%0aactivate+be%0anote+over+be%3a+get+phone+for+email%5cnstore+temporarily%3a%5cn%28vault-addr%2cnewaddr%2ctimestamp%2ctitle%29%0abe-%3euser%3a+SMS%3a+click+to+add+%28url%2bservernonce%29%0adeactivate+be%0auser-%3e%2bapp%3a+click%0aapp-%3egoogle%3a+authenticate%28email%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e%2bbe%3a+validateAddDevice%28jwt%2curl%29%0anote+over+be%0avalidate+url-nonce%2e%0asave+to+memory%0aend+note%0abe--%3e-app%3a+%28newaddr%2c+title%29+%0anote+over+app%3a+Propt+user%3a+Click+here+to%5cnadd+XXX+as+new+device%0aapp-%3e-vault%3a+addOperatorNow%28newaddr%29%0anote+over+vault%3a+PendingChange%0avault--%3e%2bbe%3a+monitor+changes%0anote+over+be%3a+validate+has+%28vault-addr%2cnewaddr%29%5cnin+memory+%28with+validate%29%0abe-%3e-vault%3a+approve%28%29%5cnas+Watchdog%0avault--%3enew%3a+monitor+change)

<a name="recoverDevice" ></a>
### Recover Device

![Recover Device](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Recover+Device%0a%0aparticipant+%22OldDevice%22+as+user%0aparticipant+%22NewDevice%22+as+new%0aparticipant+%22webapp%5cnon+newDevice%22+as+app%0aparticipant+%22Backend%22+as+be%0aparticipant+vault%0aparticipant+google%0a%0anote+over+user%3a+device%5cnlost%2e%2e%2e%0anote+over+new%3a+recover+SIM%0anew-%3e%2bapp%3a+login+%28%29%0aactivate+new%0aapp-%3egoogle%3a+authenticate%28email%29%0agoogle--%3eapp%3a+JWT%0aapp-%3e-be%3arecoverDevice%28jwt%29%0aactivate+be%0anote+over+be%3a+get+phone+for+email%0adeactivate+new%0abe-%3enew%3a+SMS%3a+click+to+recover%5cn%28email%2bserver-nonce%29%0adeactivate+be%0anew-%3e%2bapp%3a+click%0aapp-%3egoogle%3a+authenticate%28email%2c+nonce%28newaddr%29%29%0agoogle--%3eapp%3a+JWT%28with+email%2cnewaddr%29%0aapp-%3e-be%3a+addOperator%5cn%28jwt%2c+server-nonce%29%0aactivate+be%0anote+over+be%3a+validate%5cnserver-nonce%0abe-%3evault%3a+addOperator%28newaddr%29%5cnas+Admin%0anote+over+vault%3a+PendingChange%0avault--%3eapp%3a+monitor+changes%0avault--%3euser%3a+monitor+changes%0auser-%3evault%3a+%5bOPTIONAL%5d+cancelPending%0anote+over+be%3a+time+passes%2e%2e%0abe-%3e-vault%3a+apply%28%29+as+Watchdog%0avault--%3eapp%3a+monitor+change)


<a name="transfer"></a>
### Transfer

Assumes we installed the WhitelistPolicy on `transfer()`, `approval()` operations.
this delayed transfer runs whenever the target address is not in the whitelist.

![Transfer](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Transfer%0a%0aparticipant+user%0aparticipant+%22webapp%22+as+web%0aparticipant+%22guardian%5cn%28be%29%22+as+guardian%0aparticipant+%22Vault%5cn%28contract%29%22+as+vault%0a%0auser-%3e%2bweb%3a+transfer%0aweb-%3evault%3a+scheduleBypass%28DAI%2ctransfer%28dest%2caddr%29%29%0avault-%3e%2bpolicy%3a+getPolicy%28msg%2edata%29%0anote+over+policy%3a+check+sig%2c%5cnlookup+dest%0apolicy--%3e-vault%3a+%28delayed%29%0anote+over+vault%3a+pending%0avault--%3eweb%3a+view+pending%0adeactivate+web%0avault+--%3e%2b+guardian%3a+view+pending%0anote+over+guardian%3a+read+phone+from%5cnvault+db%0aguardian-%3e-user%3a+SMS%3a+click+to+cancel%2bserver-nonce%0a%0aalt+Cancel%0auser-%3e%2bweb%3a+click%0anote+right+of+web%3a+no+need%5cnto+auth%0aweb-%3e-guardian%3a+cancel%28server-nonce%29%0aactivate+guardian%0aguardian-%3evault%3a+cancelPending%5cnas+Watchdog%0adeactivate+guardian%0aelse+After+timeout%0anote+over+user%3a+ignore+cancel%5cnSMS%0a%0anote+over+guardian%3a+wait+for+timeout%0aguardian-%3evault%3a+apply%0a%0aend)

<a name="transferImmediate"></a>
### Transfer Immediate (to Whitelist)

The off-chain flow is very simple, as its a direct execution
- user calls "execute", where target is a token, and function is "transfer" (or "approve")
- based on target method, vault selects the policy, and calls `getPolicy`
- `getPolicy` validates the method is valid, and extracts address
- if address is in the whitelisted list, it returns **immediate**. Otherwise, it returns **default**
- vault continues (based on policy) and execute the transfer.

![Transfer Immediate](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Transfer+Immediate%0a%0aparticipant+user%0aparticipant+Watchdog+as+be%0aparticipant+%22Vault%5cn%28contract%29%22+as+vault%0aparticipant+%22Whitelist%5cnBypassPolicy%22+as+policy%0aparticipant+DAI%0auser-%3e%2bvault%3a+execute%28+DAI%2c+%27transfer%28dest%2camnt%29%27%29%0avault-%3e%2bpolicy%3a+getPolicy%28msg%2edata%29%0anote+over+policy%3a+check+sig%2c%5cnlookup+dest%0apolicy--%3e-vault%3a+%28immediate%29%0avault-%3eDAI%3a+transfer%28addr%2c+amnt%29)

```
title Transfer Immediate

participant user
participant Watchdog as be
participant "Vault\n(contract)" as vault
participant "Whitelist\nBypassPolicy" as policy
participant DAI
user->+vault: execute( DAI, 'transfer(dest,amnt)')
vault->+policy: getPolicy(msg.data)
note over policy: check sig,\nlookup dest
policy-->-vault: (immediate)
vault->DAI: transfer(addr, amnt)
```

<a name="addToWhitelist"></a>
### Add to WhiteList

The policy module as added "by address" as the policy for itself.
its `getPolicy` checks its own method signatures, to give them policy (in our case, `add` is delayed, `remove` is immediate)

![Add to Whitelist](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Add+to+Whitelist%0a%0aparticipant+user%0aparticipant+Watchdog+as+be%0aparticipant+%22Vault%5cn%28contract%29%22+as+vault%0aparticipant+%22WLP%3a+Whitelist%5cnBypassPolicy%22+as+policy%0auser-%3e%2bvault%3a+schedule%28+WLP%2c+%27add%28addr%29%27%29%0avault-%3e%2bpolicy%3a+getPolicy%28%29%0apolicy--%3e-vault%3a+%28delayed%29%0avault-%3e%2bvault%3a+schedule%28%29%0adeactivate+vault%0avault--%3e-be%3a+monitor%0anote+over+vault%3a+wait%2e%2e%0abe-%3evault%3a+apply%28%29%0avault-%3e%2bpolicy%3a+add%28addr%29%0adeactivate+policy)

```
title Add to Whitelist

participant user
participant Watchdog as be
participant "Vault\n(contract)" as vault
participant "WLP: Whitelist\nBypassPolicy" as policy
user->+vault: schedule( WLP, 'add(addr)')
vault->+policy: getPolicy()
policy-->-vault: (delayed)
vault->+vault: schedule()
deactivate vault
vault-->-be: monitor
note over vault: wait..
be->vault: apply()
vault->+policy: add(addr)
deactivate policy


```

<a name="removeFromWhitelist"></a>
### Remove from WhiteList


![Remove from Whitelist](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Remove+from+Whitelist%0a%0aparticipant+user%0aparticipant+Watchdog+as+be%0aparticipant+%22Vault%5cn%28contract%29%22+as+vault%0aparticipant+%22WLP%3a+Whitelist%5cnBypassPolicy%22+as+policy%0auser-%3e%2bvault%3a+execute%28+WLP%2c+%27remove%28addr%29%27%29%0avault-%3e%2bpolicy%3a+getPolicy%28%29%0apolicy--%3e-vault%3a+%28immediate%29%0avault-%3e%2bpolicy%3a+remove%28addr%29%0adeactivate+policy)

```
title Remove from Whitelist

participant user
participant Watchdog as be
participant "Vault\n(contract)" as vault
participant "WLP: Whitelist\nBypassPolicy" as policy
user->+vault: execute( WLP, 'remove(addr)')
vault->+policy: getPolicy()
policy-->-vault: (immediate)
vault->+policy: remove(addr)
deactivate policy


```


### Technical flow: Google Auth using iFrame

This is more techincal flow of using google auth and a separate "secured" iframe.
This means that the trusted app that contacts google OAuth service is not the sample app, but
"accounts.safechannel.com", which doesn't change between apps.

![Google Auth2 using iframe](http://www.websequencediagrams.com/cgi-bin/cdraw?s=rose&m=title+Google+Auth2+using+iframe%0aparticipant+user%0aparticipant+webapp+as+app%0aparticipant+iframe%0aparticipant+google%0a%0auser-%3eapp%3a+login%0aapp-%3eiframe%3a+getAddress%28%29%0aiframe--%3eapp%3a+null%0aapp-%3eiframe%3a+signIn%28%29%0aiframe-%3egoogle%3a+gapi%2esignIn%28%29%0agoogle-%3eiframe%3a+onSignIn%28JWT%29%0aiframe-%3eapp%3a+onSignIn%28JWT%29%0aapp-%3eiframe%3a+createAccount%28%29%0anote+over+iframe%3a+create%5cnPrivateKey%2c%5cnaddress%0aiframe-%3egoogle%3a+authenticate%28nonce%3aaddress%29%0anote+right+of+app%3a%0aJWT+contains%3a%0aemail%2c+timestamp%2c+nonce%3aaddress%0a%28also+iframe-url%2c+signature%29%0aend+note%0agoogle--%3eiframe%3a+jwt%0aiframe-%3eapp%3a+jwt)

```
title Google Auth2 using iframe
participant user
participant webapp as app
participant iframe
participant google

user->app: login
app->iframe: getAddress()
iframe-->app: null
app->iframe: signIn()
iframe->google: gapi.signIn()
google->iframe: onSignIn(JWT)
iframe->app: onSignIn(JWT)
app->iframe: createAccount()
note over iframe: create\nPrivateKey,\naddress
iframe->google: authenticate(nonce:address)
note right of app:
JWT contains:
email, timestamp, nonce:address
(also iframe-url, signature)
end note
google-->iframe: jwt
iframe->app: jwt
```

## Diagrams Source:
update with "websequence-md Flows.md", to read these flows into the images above.

```
title Vault Creation

participant user
participant webapp as app
participant iframe
participant google
participant "Backend" as be
participant Sponsor\n(Via GSN) as sponsor
participant factory
participant vault
user->+app: googleLogin()
app->+iframe: googleLogin()
iframe->google: gapi.signIn()
note over google: Prompt User to\nselect Account
google-->iframe: JWT(email)
iframe-->-app: JWT
app->-user: JWT
note over user: prompt for phone
user->+app: validatePhone(jwt, phone)
app->+be:validatePhone(jwt, phone)
note over user: wait for sms
deactivate app
be->-user: SMS click here (smsUrl-verifyCode)
user->+app: createWallet({sms-verifyCode})
note over app: create\naddress,PK\nsave in LocalStorage
app->google: gapi.authenticate(email, nonce:address)
google-->app: JWT(email,nonce:address)
app->+be:createAccount(JWT, smsVerifyCode)
note over be
validate JWT,
save email,phone,
parse JWT,
salt=hash(email)
sig = ecdsaSign(salt,timestamp)
end note
be-->-app: approvalData(salt,timestamp,sig)
app->sponsor: createVault(salt, { approvalData:{timestamp || sig }} )
activate sponsor
note over sponsor: validate backend-sig\non salt,timestamp
sponsor->-factory: createVault
activate factory
factory->vault: create2
factory->vault: configure
deactivate factory
vault-->-webapp: monitor changes
```


```
title Add Device Immediate

participant "NewDevice" as new
participant "OldDevice" as user
participant webapp as app
participant "Backend" as be
participant vault
participant google

new->+app: login
activate new
app->google: authenticate(email, nonce(newaddr))
google-->app: JWT
app->-be:signInAsNewOperator(jwt, title)
activate be
note over be: get phone for email\nstore temporarily:\n(vault-addr,newaddr,timestamp,title)
be->user: SMS: click to add (url+servernonce)
deactivate be
user->+app: click
app->google: authenticate(email)
google-->app: JWT
app->+be: validateAddDevice(jwt,url)
note over be
validate url-nonce.
save to memory
end note
be-->-app: (newaddr, title) 
note over app: Propt user: Click here to\nadd XXX as new device
app->-vault: addOperatorNow(newaddr)
note over vault: PendingChange
vault-->+be: monitor changes
note over be: validate has (vault-addr,newaddr)\nin memory (with validate)
be->-vault: approve()\nas Watchdog
vault-->new: monitor change
```

```
title Recover Device

participant "OldDevice" as user
participant "NewDevice" as new
participant "webapp\non newDevice" as app
participant "Backend" as be
participant vault
participant google

note over user: device\nlost...
note over new: recover SIM
new->+app: login ()
activate new
app->google: authenticate(email)
google-->app: JWT
app->-be:recoverDevice(jwt)
activate be
note over be: get phone for email
deactivate new
be->new: SMS: click to recover\n(email+server-nonce)
deactivate be
new->+app: click
app->google: authenticate(email, nonce(newaddr))
google-->app: JWT(with email,newaddr)
app->-be: addOperator\n(jwt, server-nonce)
activate be
note over be: validate\nserver-nonce
be->vault: addOperator(newaddr)\nas Admin
note over vault: PendingChange
vault-->app: monitor changes
vault-->user: monitor changes
user->vault: [OPTIONAL] cancelPending
note over be: time passes..
be->-vault: apply() as Watchdog
vault-->app: monitor change
```

```
title Transfer

participant user
participant "webapp" as web
participant "guardian\n(be)" as guardian
participant "Vault\n(contract)" as vault

user->+web: transfer
web->vault: scheduleBypass(DAI,transfer(dest,addr))
vault->+policy: getPolicy(msg.data)
note over policy: check sig,\nlookup dest
policy-->-vault: (delayed)
note over vault: pending
vault-->web: view pending
deactivate web
vault -->+ guardian: view pending
note over guardian: read phone from\nvault db
guardian->-user: SMS: click to cancel+server-nonce

alt Cancel
user->+web: click
note right of web: no need\nto auth
web->-guardian: cancel(server-nonce)
activate guardian
guardian->vault: cancelPending\nas Watchdog
deactivate guardian
else After timeout
note over user: ignore cancel\nSMS

note over guardian: wait for timeout
guardian->vault: apply

end
```

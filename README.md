# quiq-chat [![Build Status](https://travis-ci.org/Quiq/quiq-chat.svg?branch=master)](https://travis-ci.org/Quiq/quiq-chat) [![npm version](https://badge.fury.io/js/quiq-chat.svg)](https://badge.fury.io/js/quiq-chat) [![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
Library to handle the communication with Quiq Messaging APIs to build a web chat app

## Installation

Install `quiq-chat` with

```
npm install --save quiq-chat
```
or
```
yarn add quiq-chat
```

## Usage

### Using `QuiqChatClient`

The default export of `quiq-chat` is the `QuiqChatClient` singleton class which will fetch information about the current webchat, initialize a websocket connection, and allow you to register callbacks so that you can keep your app's UI in sync with the webchat state.

All the functions to register callbacks return the `QuiqChatClient` object so that you can chain them together. You also need to call `start()` to connect to Quiq Messaging. You will need to call the `initialize(host, contactPoint)` function before calling start. The `start` method returns a promise that resolves to the `QuiqChatClient`, so you can add a callback that will be executed after the connection is opened;

```javascript
import QuiqChatClient from 'quiq-chat';


  QuiqChatClient.onNewMessages(messages => {
    // Update your app with the new array of messages
  })
  QuiqChatClient.onAgentTyping(typing => {
    // Show or hide the typing indicator
  })
  QuiqChatClient.onRegistration(() => {
    // Hide form, or show main app
  })
  QuiqChatClient.onConnectionStatusChange(connected => {
    // Show the connection status of the app
  })
  QuiqChatClient.onError(error => {
    // Show some error message
  })
  QuiqChatClient.onRetryableError(error => {
    // Show some error message
  }).
  QuiqChatClient.onErrorResolved(() => {
    // Remove the error message
  })
  QuiqChatClient.start()
  .then(client => {
    // Run some code after the webchat app is connected
  });
```

### Without using `QuiqChatClient`

Before `quiq-chat` can call any APIs, you need to call `init` and pass in your site's host (i.e. `https://your-company.goquiq.com`) and the contact point you want your chat client to connect to

```javascript
import {init, fetchConversation} from 'quiq-chat';

init({
  HOST: 'https://your-company.goquiq.com',
  CONTACT_POINT: 'default',
});

// Now we can call the API
fetchConversation().then(conversation => {
  // Do something with the conversation object
});
```

Trying to call any other methods before `init` will throw an error

## Documentation

### QuiqChatClient

#### onNewMessages(messages: Array<[Message](#message)>) => [QuiqChatClient](#quiqchatclient)
Called whenever new messages are received. `messages` is an array containing full transcript of the current chat

#### onAgentTyping(typing: boolean) => [QuiqChatClient](#quiqchatclient)
Called whenever the support agent starts or stops typing

#### onError(error: ?ApiError) => [QuiqChatClient](#quiqchatclient)
Called whenever there is a non-retryable error or an error that has exceeded the maximum number of retries from the API.

#### onRetryableError(error: ?ApiError) => [QuiqChatClient](#quiqchatclient)
Called whenever there is a retryable error from the API

#### onErrorResolved() => [QuiqChatClient](#quiqchatclient)
Called whenever any error from the API has been resolved

#### onRegistration() => [QuiqChatClient](#quiqchatclient)
Called when Register event is received through a websocket message

#### onConnectionStatusChanged(connected: boolean) => [QuiqChatClient](#quiqchatclient)
Called when a connection is established or terminated

#### onBurn() => [QuiqChatClient](#quiqchatclient)
Called when quiq-chat gets in a fatal state and page holding webchat needs to be refreshed

#### onClientInactiveTimeout() => [QuiqChatClient](#quiqchatclient)
Called when quiq-chat disconnects the websocket due to the chat client being inactive for a set amount of time

#### start() => Promise<[QuiqChatClient](#quiqchatclient)>
Establishes the connection to QuiqMessaging

#### stop() => void
Disconnects the websocket from Quiq

### Other methods

#### subscribe(callbacks: WebsocketCallbacks) => void
Opens a websocket connection and hook up some callbacks

```javascript
import {subscribe} from 'quiq-chat';

subscribe({
  onConnectionLoss() {
    // Called when the connection is lost
  },

  onConnectionEstablish() {
    // Called when the connection is established or reopened after a disconnect
  },

  onMessage(message) {
    // React to the websocket message
  },

  onTransportFailure(error, req) {
    // Called if websockets don't work and we need to fall back to long polling
  },

  onClose() {
    // Called if the websocket connection gets closed for some reason
  },

  onBurn(burnData) {
    // Called if the client gets in a bad state and can't make any more network requests (need to hit refresh)
  }
});
```

The `message` object in `handleMessage` is of the type
```javascript
{
  data: Object,
  messageType: 'Text' | 'ChatMessage',
  tenantId: string
}
```
The `ApiError` object in `onError` and`onRetryableError` is of the type
```javascript
{
  code?: number,
  message?: string,
  status?: number,
}
```

#### unsubscribe() => void
Unsubscribes from the current websocket connection

#### fetchConversation() => Promise\<Conversation\>
Fetches the current conversation object from Quiq

#### addMessage(text:string) => void
Sends the text as a webchat message in to Quiq Messaging

#### joinChat() => void
Sends a message to Quiq Messaging that the end user has opened the chat window

#### leaveChat() => void
Sends a message to Quiq Messaging that the end user has closed the chat window

#### updateMessagePreview(text:string, typing:boolean) => void
Sends a message to Quiq Messaging that the end user is typing and what they've typed in the message field

#### checkForAgents() => Promise<{available: boolean}>
Fetches whether or not there are agents available for the contact point the webchat is connected to

#### sendRegistration(data: {[string]: string}) => Promise<void>
Submits a map of custom `(key, value)` pairs to be included in the data for the current chat.
Method accepts a single parameter, a JavaScript object with values of type `String`.
`key` is limited to 80 characters and must be unique; `value` is limited to 1000 characters.

#### isStorageEnabled = () => boolean
Utility function to tell the client if quiq-chat has the capability to set its required data in a
persistent way. If this returns false, quiq-chat will cease to function, and will block all requests.

#### hasTakenMeaningfulAction() => boolean
Returns whether the end-user has performed a meaningful action, such as
submitting the Welcome Form, or sending a message to the agent.

#### isChatVisible() => boolean
Returns the last state of chat's visibility.  Only includes actions that call the joinChat and leaveChat events.
For instance, if your user maximizes chat, but you never call joinChat, isChatVisible won't reflect this change.
Can be used to re-open webchat on page turns if the user had chat previously open. Defaults to false if user has taken no actions.

## Data types

### Message
```javascript
{
  authorType: 'Customer' | 'Agent',
  text: string,
  id: string,
  timestamp: number,
  type: 'Text' | 'Join' | 'Leave',
}
```

### Conversation
```javascript
{
  id: string,
  messages: Array<Message>,
}
```

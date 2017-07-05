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

The default export of `quiq-chat` is the `QuiqChatClient` class which will fetch information about the current webchat, initialize a websocket connection, and allow you to register callbacks so that you can keep your app's UI in sync with the webchat state.

All the functions to register callbacks return the `QuiqChatClient` object so that you can chain them together. You also need to call `start()` to connect to Quiq Messaging. The `start` method returns a promise that resolves to the `QuiqChatClient`, so you can add a callback that will be executed after the connection is opened;

```javascript
import QuiqChatClient from 'quiq-chat';

const client = new QuiqChatClient()
  .onNewMessages(messages => {
    // Update your app with the new array of messages
  })
  .onAgentTyping(typing => {
    // Show or hide the typing indicator
  })
  .onConnectionStatusChange(connected => {
    // Show the connection status of the app
  })
  .onError(error => {
    // Show some error message
  })
  .onErrorResolved(() => {
    // Remove the error message
  })
  .start()
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
Called whenever new messages are received. `messages` is an array containing all the messages in the current chat (not just the ones that are new)

#### onAgentTyping(typing: boolean) => [QuiqChatClient](#quiqchatclient)
Called whenever the support agent starts or stops typing

#### onError(error: ?ApiError) => [QuiqChatClient](#quiqchatclient)
Called whenever there is an error from the API

#### onErrorResolved() => [QuiqChatClient](#quiqchatclient)
Called whenever the error from the API has been resolved

#### onConnectionStatusChanged(connected: boolean) => [QuiqChatClient](#quiqchatclient)
Called when a connection is established or terminated

#### start() => Promise<[QuiqChatClient](#quiqchatclient)>
Establishes the connection to QuiqMessaging

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

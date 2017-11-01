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

## Documentation

### Supported Browsers
QuiqChat works with any browser that supports Local Storage, standard AJAX CORS requests. The standard implementation of the Chat client supports a subset of these browsers, and we recommend any custom implementations support the same browsers.  The `isSupportedBrowser` utility function can be used to determine if the end-user is using a browser supported by Quiq. The following browsers with versions greater than or equal to the following are supported.
  * Chrome 43
  * Firefox 48.0
  * Safari 6.1
  * Internet Explorer 10
  * Internet Explorer 11
  * Microsoft Edge 12
  * Mobile devices

### QuiqChatClient

#### onNewMessages(messages: Array<[TextMessage](#TextMessage)>) => [QuiqChatClient](#quiqchatclient)
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

#### onSendTranscript(event: [Event](#Event)) => [QuiqChatClient](#quiqchatclient)
Called when a transcript is requested either through a websocket message or as a new event on the transcript

#### onNewSession() => [QuiqChatClient](#quiqchatclient)
Called when the end users previous session has expired and has begun a new session.  This is a good spot to
have the UI reset itself to an initial state

#### onConnectionStatusChanged(connected: boolean) => [QuiqChatClient](#quiqchatclient)
Called when a connection is established or terminated

#### onBurn() => [QuiqChatClient](#quiqchatclient)
Called when quiq-chat gets in a fatal state and page holding webchat needs to be refreshed

#### onClientInactiveTimeout() => [QuiqChatClient](#quiqchatclient)
Called when quiq-chat disconnects the websocket due to the chat client being inactive for a set amount of time

#### getMessages(cache?: boolean = true) => Promise<Array<[TextMessage](#TextMessage)>>
Retrieve all messages for the current chat.  If `cache` is set to true, a hit to the API is not made, and only the messages currently in memory are returned.

#### emailTranscript(data: [EmailTranscriptPayload](#EmailTranscriptPayload)) => void
Email a transcript of the current conversation to the specified e-mail.  If an agent has not yet responded to the conversation, a 400 will be returned.

#### sendTextMessage(text: string) => void
Send a text message from the customer.  Can be used to initiate a conversation if no messages have been sent.

#### start() => Promise<[QuiqChatClient](#quiqchatclient)>
Establishes the connection to QuiqMessaging

#### stop() => void
Disconnects the websocket from Quiq

#### isStorageEnabled() => boolean
Utility function to tell the client if quiq-chat has the capability to set its required data in a
persistent way. If this returns false, quiq-chat will cease to function, and will block all requests.

#### isSupportedBrowser() => boolean
Utility function to return if the end-user is using a browser supported by Quiq.

#### hasTakenMeaningfulAction() => boolean
Returns whether the end-user has performed a meaningful action, such as
submitting the Welcome Form, or sending a message to the agent.

#### isChatVisible() => boolean
Returns the last state of chat's visibility.  Only includes actions that call the joinChat and leaveChat events.
For instance, if your user maximizes chat, but you never call joinChat, isChatVisible won't reflect this change.
Can be used to re-open webchat on page turns if the user had chat previously open. Defaults to false if user has taken no actions.

#### sendRegistration(data: {[string]: string}) => Promise<void>
Submits a map of custom `(key, value)` pairs to be included in the data for the current chat.
Method accepts a single parameter, a JavaScript object with values of type `String`.
`key` is limited to 80 characters and must be unique; `value` is limited to 1000 characters.

#### getHandle() => Promise<handle: string>
Fetches a unique handle to track the session through.  If a session already exists for the current user, a network request is skipped and that value is instead returned.  The value of this call is cached for 10 seconds.

#### checkForAgents() => Promise<{available: boolean}>
Fetches whether or not there are agents available for the contact point the webchat is connected to.  The value of this call is cached for 10 seconds.

#### updateTypingIndicator(text:string, typing:boolean) => void
Sends a message to Quiq Messaging that the end user is typing and what they've typed in the message field

#### joinChat() => void
Sends a message to Quiq Messaging that the end user has opened the chat window

#### leaveChat() => void
Sends a message to Quiq Messaging that the end user has closed the chat window

#### isRegistered() => boolean
Returns whether the end user has triggered a registration event.  This happens when the `sendRegistration` API is called, and the server has confirmed the registration was valid.

## Data types

### TextMessage
```javascript
{
  authorType: 'Customer' | 'User' | 'System',
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
  messages: Array<TextMessage>,
}
```

### ApiError
```javascript
{
  code?: number,
  message?: string,
  status?: number,
}
```


### UserEvent
```javascript
'Join' | 'Leave'
```

### EmailTranscriptPayload
```javascript
{
  email: string,
  originUrl: string,
  timezone?: string,
};
```

### Event
```javascript
  {
    id: string,
    timestamp: number,
    type: string,
  };
```
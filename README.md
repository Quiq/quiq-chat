# quiq-chat [![Build Status](https://travis-ci.org/Quiq/quiq-chat.svg?branch=master)](https://travis-ci.org/Quiq/quiq-chat) [![npm version](https://badge.fury.io/js/quiq-chat.svg)](https://badge.fury.io/js/quiq-chat) [![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

A high-level JavaScript Library to handle the communication with Quiq Messaging APIs when building a web chat app

## Installation

Install `quiq-chat` with

```
npm install --save quiq-chat
```

or

```
yarn add quiq-chat
```

### ES6 Polyfill
This library is built for modern browsers, and expects access to ES6 prototype methods. 
If you need to target older browsers, you'll need to include a polyfill. We recommend babel-polyfill:

Install with

```
npm install --save babel-polyfill
```

or

```
yarn add babel-polyfill
```

Then include at the top of your module like so:

```
import 'babel-polyfill';
```

Note that this will modify the prototypes of global objects such as Array and Object, as well as add a Promise prototype.

## Usage
The quiq-chat library exports a QuiqChatClient, which is a singleton. 
This means that you can import it as many times as you want, in as many modules as you want, and always get back the same instance of the client.

Import it like so:

```
import QuiqChatClient from 'quiq-chat';
```

`QuiqChatClient` exposes a fluent API for client setup, allowing you to chain calls together. 
First, we call `initialize(host, contactPoint)`. We then register our own handler functions to respond to different chat events. Finally, we call `start()`.
The `start` method returns a promise that resolves once the client is fully initialized and ready to send and receive messages.

Below we show a simple setup, with handler functions for new transcript elements and agent typing events. 

```javascript
QuiqChatClient
    .initialize('tenant.goquiq.com', 'default')
    .onTranscriptChange(messages => {
        // Will log out messages and events (such as user registration and transcript email)
        messages.forEach(msg => console.log(msg)
    })
    .onAgentTyping(isTyping => {
        if (isTyping) {
            console.log("The agent started typing!")
        } else {
            console.log("The agent stopped typing!")
        }
    })
    // Connect that chat client
    .start()
    .then(() => {
        console.log("The chat client is connected and ready to send and receive messages");
    });
```

## Starting and stopping the client
#### start() => Promise<[QuiqChatClient](#quiqchatclient)>

Begins the chat session, allowing the client to send and receive messages. Should be called immediately after initializing and registering event handlers.
The returned Promise is resolved once the session is active and everything is ready to go.

#### stop() => void

Ends the chat session. The client will no longer receive messages.

## Handling events
Register your event handling functions prior calling `QuiqChatClient.start()`. All of these methods can be chained together.

#### onTranscriptChange(transcriptItems: Array<[ConversationMessage](#ConversationMessage) | [Event](#Event)>) => [QuiqChatClient](#quiqchatclient)

Called whenever new messages are received. `transcriptItems` is an array containing full transcript (messages and events) of the current chat.

#### onAgentTyping(typing: boolean) => [QuiqChatClient](#quiqchatclient)

Called whenever the support agent starts or stops typing

#### onError(error: ?ApiError) => [QuiqChatClient](#quiqchatclient)

Called whenever there is a non-retryable error or an error that has exceeded the maximum number of retries from the API.

#### onErrorResolved() => [QuiqChatClient](#quiqchatclient)

Called whenever any error from the API has been resolved

#### onMessageSendFailure = (callback: (messageId: string) => void) => [QuiqChatClient](#quiqchatclient)

Called when a text or attachment message could not be delivered to the agent.

#### onRegistration() => [QuiqChatClient](#quiqchatclient)

Called when Register event is received through a websocket message

#### onNewSession() => [QuiqChatClient](#quiqchatclient)

Called when the end users previous session has expired and has begun a new session. This is a good spot to
have the UI reset itself to an initial state

#### onAgentAssigned(agentAssigned: boolean) => [QuiqChatClient](#quiqchatclient)

Called when the isAgentAssigned value changes.

#### onEstimatedWaitTimeChanged(estimatedWaitTime: ?number) => [QuiqChatClient](#quiqchatclient)

Called when the estimate wait time calculation changes.

#### onReconnect(reconnecting: boolean) => [QuiqChatClient](#quiqchatclient)

Called when chat is trying to reconnect with Quiq's servers (`reconnecting === true`), or has finished reconnecting (`reconnecting === false`). This can be used for showing a "we're trying to reconnect you" message or similar.

#### onBurn() => [QuiqChatClient](#quiqchatclient)

Called when quiq-chat gets in a fatal state and page holding webchat needs to be refreshed.

#### onPersistentDataChange(callback: (data: [PersistentData](#PersistentData)) => void) => [QuiqChatClient](#quiqchatclient)

Called whenever Quiq-related data stored in the browser's localStorage changes.

## Update, and set and retrieve context
Context is data that is set by the chat client and is available throughout the Quiq system as part of the conversation. It can be viewed by agents, included in webhooks and leveraged in queuing rules.

#### getChatContext(context: ChatContext)
Retrieves the current chat context.

#### setChatContext(context: ChatContext)
Replaces the entire context. This new context will be sent to Quiq with every subsequent message.

#### updateChatContext(updates: Partial<ChatContext>)
Performs a shallow merge of the current context with the provided updates. The resulting context will be sent to Quiq with every subsequent message.

## Retrieve messages and conversation events
#### getTranscript(cache?: boolean = true) => Promise<Array<[ConversationMessage](#ConversationMessage) | [Event](#Event)>>

Retrieve all messages and events for the current chat. If `cache` is set to true, a hit to the API is not made, and only the messages currently in memory are returned.

## Sending messages
#### sendTextMessage(text: string) => void

Send a text message from the customer. The first message sent from the client will initialize (start) a conversation.

#### sendAttachmentMessage(file: File, prog#ressCallback: (progress: number) => void) => Promise<string>

Send an attachment message containing a File from the customer. The type of this file must conform to the allowed file types set in your configuration. The method also accepts a `progressCallback` function which will be fired during upload of the file with values between 0 and 100, denoting percentage uploaded. Upon completion of upload, this method returns a string containing the `id` of the new message.

## User Registration
#### isRegistered() => boolean

Returns whether the end user has triggered a registration event. This happens when the `sendRegistration` API is called, and the server has confirmed the registration was valid.

## Session
#### getHandle() => Promise<handle?: string>

Returns the unique identifier for this session. If the user is not logged in, returns `undefined`.

#### login() => Promise<handle: string>

Creates a session for the current user, if one does not already exist. Returns the unique identifier (handle) for the new or existing session.

#### checkForAgents() => Promise<{available: boolean}>

Fetches whether or not there are agents available for the contact point the webchat is connected to. The value of this call is cached for 10 seconds.

#### updateTypingIndicator(text:string, typing:boolean) => void

Sends a message to Quiq Messaging that the end user is typing and what they've typed in the message field

#### isAgentAssigned() => boolean

Returns whether the end user's chat has been taken up by an agent. This returns true when the agent sends their first message.

#### getEstimatedWaitTime() => ?number

Returns the estimate wait time in milliseconds. This is the amount of time we estimate it will take for the user's chat to be assigned to an agent. If this is undefined or null, then no ETA is currently available.

## Email the conversation transcript
#### emailTranscript(data: [EmailTranscriptPayload](#EmailTranscriptPayload)) => void
Email a transcript of the current conversation to the specified e-mail. If an agent has not yet responded to the conversation, a 400 will be returned.

## Setting the logging level
#### setLogLevel(level: trace | debug, info | warn | error | silent) => [QuiqChatClient](#quiqchatclient)
Sets which levels of log statements will be output to the console. Pass in `silent` to disable logging entirely.

## Utilities
#### isStorageEnabled() => boolean

Utility function to tell the client if quiq-chat has the capability to set its required data in a persistent way.

#### isSupportedBrowser() => boolean

Utility function to return if the end-user is using a browser supported by Quiq.

#### hasTakenMeaningfulAction() => boolean

Returns whether the end-user has performed a meaningful action, such as
submitting the Welcome Form, or sending a message to the agent.

#### isChatVisible() => boolean

Returns the last state of chat's visibility. Can be used to re-open webchat on page turns if the user had chat
previously open. Defaults to false if user has taken no actions.

#### getPersistentData() => [PersistentData](#PersistentData)

Returns all Quiq-related data stored locally in the browser's localStorage. Includes any custom data set using the `setCustomPersistentData()` method.

#### setCustomPersistentData(key: string, value: any) => void

Stores a key/value pair in persistent storage (available between refreshes and browser closes). Can be retrieved using the `getPersistentData()` method.

## Data types

### ConversationMessage

```javascript
TextMessage | AttachmentMessage;
```

### TextMessage

```javascript
{
    authorType: 'Customer' | 'User',
    text: string,
    id: string,
    timestamp: number,
    type: 'Text',
}
```

### AttachmentMessage

```javascript
{
  id: string,
  timestamp: number,
  type: 'Attachment',
  authorType: 'Customer' | 'User',
  url: string,
  contentType: string,
}
```

### Event

```javascript
{
  authorType?: 'Customer' | 'User',
  id: string,
  timestamp: number,
  type: 'Join' | 'Leave' | 'Register' | 'SendTranscript' | 'End' | 'Spam',
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
'Join' | 'Leave';
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

### ChatContext

```javascript
    {
      href?: string,    // The URL of the page from which the customer is currently chatting. For example, agents can use this value to know which product the customer is viewing.
      intent?: string,  // Indicates the "purpose" of a conversation, can be used in the Quiq queuing system to control where the chat conversation is routed.
      data?: Object,    // Arbitrary, serialiozable data that can be accessed in bots, webhokos and queing rules.
    };
```

## Supported Browsers

QuiqChat works with any browser that supports Local Storage, and CORS requests. The `isSupportedBrowser` utility function can be used to determine if the end-user is using a browser supported by Quiq. The following browsers and versions are supported:

* Chrome 43
* Firefox 48.0
* Safari 6.1
* Internet Explorer 10
* Internet Explorer 11
* Microsoft Edge 12
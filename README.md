# @imqueue/pg-pubsub

[![Build Status](https://travis-ci.com/imqueue/pg-pubsub.svg?branch=master)](https://travis-ci.com/imqueue/pg-pubsub)
[![codebeat badge](https://codebeat.co/badges/6530d335-8799-4485-9e41-8c7e18d1f2a6)](https://codebeat.co/projects/github-com-imqueue-pg-ip-listen-master)
[![Coverage Status](https://coveralls.io/repos/github/imqueue/pg-pubsub/badge.svg?branch=master)](https://coveralls.io/github/imqueue/pg-pubsub?branch=master)

**Reliable PostgreSQL LISTEN/NOTIFY with inter-process lock support**

## What Is This?

This library provides a clean way to use PostgreSQL 
[LISTEN](https://www.postgresql.org/docs/current/sql-listen.html) and 
[NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html) commands
for its asynchronous mechanism implementation. It comes as a top-level wrapper
over [node-postgres](https://www.npmjs.com/package/pg) and provides better,
cleaner way to work with database notifications engine.

To make it clear - it solves several major problems you will fall into if 
you're going to use LISTEN/NOTIFY in your node app:

 1. **Reliable connections**. This library comes with handy reconnect support
    out-of-the box, so all you need, is, probably to tune several settings if
    you have special needs, like max retry limit or reconnection delay.
 2. It provides **clean way working with channels**, so you may subscribe to
    exactly required channel with no need to do additional filtering
    implementation on messages receive. BTW, it does nod hide from you
    possibility to manage all messages in a single handler. You just choose
    what you need.
 3. Most important feature here is that this library comes with the first-class
    implementation of **inter-process locking mechanism**, allowing to avoid 
    data duplication receive problem in scalable distributed architectures. It
    means it allows you to define single-listener process across many similar
    processes (which happens on scales) which would receive notifications
    and with guarantee that if it looses connection or dies - another similar
    process replaces it as listener.

## Install

As easy as:

~~~bash
npm i --save @imqueue/pg-pubsub
~~~ 

## Usage & API

### Importing, instantiation and connecting

~~~typescript
import { PgPubSub } from '@imqueue/pg-pubsub';

const connectionString = 'postgres://user:pass@localhost:5432/dbname';
const pubSub = new PgPubSub({ connectionString, singleListener: false });

(async () => {
    await pubSub.connect();
})();
~~~

### Listening channels

After connection established you may decide to listen for any numbers of 
channels your application may need to utilize:

~~~typescript
await pubSub.listen('UserChanged');
await pubSub.listen('OrderCreated');
await pubSub.listen('ArticleUpdated');
~~~

### Handling messages

All payloads on messages are treated as JSON, so when the handler catch a
message it is already parsed as JSON value, so you do not need to manage
serialization/deserialization yourself.

There are 2 ways of handling channel messages - by using `'message'` event
handler on `pubSub` object, or using `pubSub.channels` event emitter and to
listen only particular channel for it's messages. On message event fires first,
channels events fires afterwards, so this could be a good way if you need to
inject and transform particular message in a synchronous manner before it
will come to a particular channel listeners.

~~~typescript
// using 'message' handler:
pubSub.on('message', (channel: string, payload: AnyJson) => {
    // ... do the job
    switch (channel) {
        case 'UserChanged': {
            // ... do some staff with user change event payload
            break;
        }
        default: {
            // do something with payload by default
            break;
        }
    }
});
~~~

~~~typescript
// handling using channels
pubSub.channels.on('UserChanged', (payload: AnyJson) => {
    // do something with user changed payload
});
pubSub.channels.on('OrderCreated', (payload: AnyJson) => {
    // do something with order created payload
});
pubSub.channels.on('ArticleUpdated', (payload: AnyJson) => {
    // do something with article updated payload
});
~~~

Of course, it is better to setup listeners before calling `connect()` that it
starts handle payloads right up on connect time.

### Publishing messages

You can send messages in many different ways. For example, you may create
database triggers which would notify all connected clients with some
specific updates. Or you may use a database only as notifications engine
and generate notifications on application level. Here is how you can send
notification with `PgPubSub` API:

~~~typescript
pubSub.notify('UserChanged', {
    old: { id: 777, name: 'John Doe', phone: '555-55-55' },
    new: { id: 777, name: 'Sam Peters', phone: '777-77-77' },
});
~~~

Now all subscribers, who listening `'UserChanged''` channel will receive given
payload JSON object.

## Single Listener (Inter Process Locking)

There are variety of many possible architectures to come up with when you're
building scalable distributed system. 

With services on scale in such systems it might be a need to make sure only
single service of many similar running is listening to particular database
notifications.
Here why comes an idea of inter process (IP) locking mechanism, which would
guarantee that only one process handles the notifications and if it dies,
next one which is live will immediately handle listening.

This library comes with this option turned on by default. To make it work in
such manner, you would need to skip passing `singleListener` option to
`PgPubSub` constructor or set it to `true`:

~~~typescript
const pubSub = new PgPubSub({ connectionString });
// or, equivalently
const pubSub = new PgPubSub({ connectionString, singleListener: true });
~~~ 

Locking mechanism utilazes the same connection and LISTEN/NOTIFY commands, so
it won't consume any additional computing resources.

Also, if you already working with `pg` library in your application and you
have a need to keep only single connection using, you can bypass it directly
as `pgClient` option. But that is not always a good idea. You have to understand
what you are doing and what your need is:

~~~typescript
const pubSub = new PgPubSub({ pgClient: existingClient, singleListener: true });
~~~

## Full API Docs

You may read a code of library itself, use hints in your IDE or generate
HTML docs with:

~~~bash
git clone git@github.com:imqueue/pg-pubsub.git
cd pg-pubsub
npm i
npm run doc
~~~

## Finally

Basic example of code (copy-paste, run as several processes and see what's 
happened, just don't forget to use correct db connection string):

~~~typescript
import { PgPubSub } from '@imqueue/pg-pubsub';

function printChannels(pubSub: PgPubSub) {
    console.log('active:', pubSub.activeChannels());
    console.log('inactive:', pubSub.inactiveChannels());
    console.log('all:', pubSub.allChannels());
}

(async () => {
    const CHANNEL = 'TestChannel';
    const pubSub = new PgPubSub({
        connectionString: 'postgres://postgres@localhost:5432/postgres',
    });

    pubSub.on('error', console.log);
    pubSub.on('connect', () => console.log('connected'));
    pubSub.on('end', () => console.log('closed'));
    pubSub.on('listen', console.log);
    pubSub.channels.on(CHANNEL, console.log);

    await pubSub.connect();
    await pubSub.listen(CHANNEL);

    setInterval(async () => {
        await pubSub.notify('TestChannel', {
            some: { json: 'object' },
            and: true,
        });
        printChannels(pubSub)
    }, 5000);
})();
~~~

## License

[ISC](https://github.com/imqueue/pg-pubsub/blob/master/LICENSE)

Happy Coding!

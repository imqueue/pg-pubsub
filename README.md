# @imqueue/pg-ip-listen

Reliable PostgreSQL LISTEN/NOTIFY with inter-process lock support

## Why?

With services on scale it might be a need to make sure only single service of
many similar running listening to database notifications. Here comes idea of
inter process (IP) locking mechanism, which would guarantee that
only one process handles the notifications and if it dies, next one which is
live will immediately handle listening.

This library provides exactly this functionality, utilizing a single database
connection for entire logic, which is the most efficient way in terms of
utilizing computing resources.

This option comes enabled by default, but may be turned off if there is a need
to have only pub/sub on entire subset of running concurrent processes.

## Install

As easy as:

~~~bash
npm i --save @imqueue/pg-listen
~~~ 

## Usage

Create file `debug.ts` as follows:

~~~typescript
import { PgPubSub } from '@imqueue/pg-ip-listen';

(async () => {
    const pubSub = new PgPubSub({
        connectionString: 'posgtres://user:pass@localhost:5432/dbname',
    });

    pubSub.on('error', console.log);
    pubSub.on('connect', () => console.log('connected'));
    pubSub.on('end', () => console.log('closed'));
    pubSub.on('message', console.log);
    pubSub.on('listen', console.log);

    await pubSub.connect();
    await pubSub.listen('TestChannel');

    setInterval(async () => {
        await pubSub.notify('TestChannel', {
            some: { json: 'object' },
            and: true,
        });
    }, 5000);
})();
~~~

Now try to run this using, for-example, `ts-node` REPL in a several screens:

~~~bash
ts-node debug.ts
~~~

You'll find that all running processes connected, but only one of them is 
listening. Try to kill with `^C` listening process. Check other processes, you
will find that one of them now listening for messages.

If you need full Pub/Sub across all processes, modify instantiation of `pubSub`
object like this:

~~~typescript
const pubSub = new PgPubSub({
    connectionString: 'posgtres://user:pass@localhost:5432/dbname',
    oneProcessListener: false,
});
~~~

Now re-run experiment.

## Docs

~~~bash
git clone git@github.com:imqueue/pg-ip-listen.git
cd pg-ip-listen
npm i
npm run doc
~~~

## License

[ISC](https://github.com/imqueue/pg-ip-listen/blob/master/LICENSE)

Happy Coding!

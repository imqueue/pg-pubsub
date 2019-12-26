# @imqueue/pg-listen

Reliable PostgreSQL LISTEN/NOTIFY with inter-process lock support

## Why?

With services on scale it might be a need to make sure only single service of
many similar running listening to database notifications. Here comes idea of
inter process communication (IPC) locking mechanism, which would guarantee that
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

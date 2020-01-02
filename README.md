# Examples Usage @imqueue/pg-pubsub

This `examples` branch specially created to provide minimal code examples
of `@imqueue/pg-pubsub` usage. Currently there are the following different
scenario usage examples available:

 - [Multi-process Listener](multi-listener.ts). All processes listening
   everything and emitting messages.
 - [Filtered Listener](filtered.ts). All processes listening everything and 
   emitting messages, but during listening self-emitted messages are skipped
   from handling.
 - [Single-process Listener](single-listener.ts). All processes emitting
   messages to the channel, but only one process at a time is listening
   to that channel.

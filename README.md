# Mini-Redis

A small Redis clone written in TypeScript, built to learn how Redis works: its wire protocol (RESP) and how a server turns bytes from a socket into commands and replies. It follows the Coding Challenges "Build Your Own Redis Server" challenge and Redis's documentation.

## Command list
| Command | Syntax                                              | Description                                       | Example                      |
| ------- | --------------------------------------------------- | ------------------------------------------------- | ---------------------------- |
| PING    | `PING [message]`                                    | Check the connection                              | `PING`                       |
| ECHO    | `ECHO message`                                      | Return the given message                          | `ECHO hello`                 |
| SET     | `SET key value [EX seconds  \| PX milliseconds  \| EXAT unix-time-seconds \| PXAT unix-time-milliseconds]` | Store a value, optionally with an expiry     | `SET drink coffee EX 60`     |
| GET     | `GET key`                                           | Read a value (null if the key is missing)         | `GET drink`                  |
| EXIST   | `EXISTS key [key ...]`                              | Count how many of the given keys are present      | `EXISTS drink`               |
| DEL     | `DEL key [key ...]`                                 | Delete keys, returns how many were removed        | `DEL drink`                  |
| INCR    | `INCR key`                                          | Add one to a stored integer                       | `INCR counter`               |
| DECR    | `DECR key`                                          | Subtract one from a stored integer                | `DECR counter`               |
| LPUSH   | `LPUSH key value [value ...]`                       | Push values onto the head of a list               | `LPUSH jobs a b`             |
| RPUSH   | `RPUSH key value [value ...]`                       | Push values onto the tail of a list               | `RPUSH jobs a b`             |
| SAVE    | `SAVE`                                              | Write a snapshot to disk                          | `SAVE`                       |

Commands behave *similarly* to their Redis counterparts, as described in Redis's documentation.

## Design details

How one request moves through the server:

```
client (redis-cli, ioredis)
   │  raw bytes: *2\r\n$3\r\nGET\r\n$5\r\ndrink\r\n
   ▼
server.ts  socket "data" event - (if a SAVE is running: wait in queue)
   │  chunk
   ▼
handleMessages
   │
   ├─ parse ──────────► ["GET", "drink"]        (array of strings)
   │
   ├─ handleCommands ─► looks up the "GET" handler and runs it
   │        │               ▲
   │        └──► store ─────┘         
   │  result: "coffee" 
   │
   ├─ serialize ──────► $6\r\ncoffee\r\n
   │
   │  any thrown Error at any step ──► serialize ──► -ERR message\r\n
   ▼
server.ts  socket.write(reply)
   │
   ▼
client
```
- **Server (`server.ts`):** accepts TCP connections, passes each chunk to `handleMessages`, and writes the reply back.
- **Orchestration (`handleMessages`):** calls `parse`, `handleCommands` and `serialize` in order. It wraps all of them in a try/catch, so any thrown error becomes an `-ERR ...` reply and one bad command never crashes the server.
- **Protocol (`parse`, `serialize`):** `parse` turns RESP into values and `serialize` turns replies back into RESP. Bulk strings are read by declared byte length, so values containing `\r\n` or multibyte characters parse correctly.
- **Commands (`handleCommands`):** handlers live in a lookup map keyed by case-insensitive command name, and a handler throws an `Error` for bad input.
- **Store:** a wrapper around a `Map`. Handlers call it, not `handleMessages`. Expired entries are checked through `getLiveEntry` before they're returned or saved.
- **Replies in order:** `SAVE` is async, so the server queues later chunks from that connection until the save finishes.

## Save details

SAVE writes the current store snapshot as JSON to dump.json in the current working directory. The server loads that snapshot when it starts; missing snapshots start with an empty store, while invalid snapshots or other file errors prevent startup. For an invalid snapshot, the startup error includes the file path and recovery guidance: back up and repair the file, or remove it to start with an empty store, then restart. Expired entries are omitted when saving and loading. startServer accepts an optional second argument to select a different snapshot path.

Command handling stays synchronous for ordinary commands. SAVE is asynchronous, and the server queues later requests from that same connection until the save finishes so replies remain in order.

NOTE: It is noticed that making the normal commands asynchronous with SAVE causes significant overhead on performance as found through Redis benchmark compared to when it is not async. This is most likely due to a combination of old commands already being lightweight and new scheduling cost for each request.

## Performance

Measured with `redis-benchmark -t set,get -n 100000 -q` against the local server, on the same machine as real Redis. Rows with a range come from several runs; the others are a single run.

| Version                              | SET (req/s)       | GET (req/s)       | p50 SET / GET (ms) |
| ------------------------------------ | ----------------- | ----------------- | ------------------ |
| Before async changes (`split`/`shift` parser, all sync) | 76,336 | 80,451 | 0.559 / 0.543 |
| After async changes (every command async) | 55,772       | 64,062            | 0.823 / 0.783      |
| Partial async + pointer (only `SAVE` async, cursor parser) | 72,727 | 80,321 | 0.735 / 0.655 |
| Real Redis (same machine)            | 141,844 | 141,443 | 0.183             |

The `WARNING: Could not fetch server CONFIG` line is expected: the benchmark tool asks for server settings through `CONFIG`, which isn't implemented here. It doesn't affect the results.

### What the numbers show

- **Making every command async cost the most.** Throughput dropped by roughly 27% for SET and 20% for GET. Ordinary commands were already cheap, so the extra scheduling per request became a large share of the work.
- **Keeping ordinary commands synchronous recovered most of it.** Only `SAVE` is async now, and GET is back to about its original speed. SET is within roughly 5 to 7% of the original.
- **The cursor parser was a correctness change, not a speed change.** It was added so that values containing `\r\n`, multibyte text and nested arrays parse correctly, and it changed throughput very little.
- **The server reaches about half of real Redis's SET throughput and about 57% of its GET throughput,** with p50 latency about 3.5 to 4 times higher. Real Redis is C; this is single-threaded Node.

### Profiling

A CPU profile (`node --cpu-prof`) taken during a 500,000-request benchmark showed:

| Share of profile | What                                               |
| ---------------- | -------------------------------------------------- |
| ~75%             | Writing replies to the socket (`writeUtf8String` alone is ~70% self time) |
| ~17%             | `parse` (about 10% of the profile is in `readLine`) |
| ~3%              | Command handlers, store and `serialize` combined   |
| ~2%              | Node's socket read path                            |

aptured with `node --cpu-prof` during `redis-benchmark -t set,get -n 500000 -q`. The profiler slows the process down, so these are proportions, not exact figures.

**Takeaway:** with one request and one reply at a time, the benchmark is dominated by the cost of one socket write per reply. Optimizing the parser or command layer can only recover a small part of the total, which matches the small effect of the cursor rewrite. The most direct way to reduce write cost is to write fewer times, so the next planned change is pipelining: parse every command in a chunk and send all the replies with a single `write`.

## Future improvements

- Handle several commands arriving in one network chunk (pipelining) + add support for adding client info
- Log system to work with the snapshots save 
- Handle a command split across several chunks
- Argument-count errors for `GET` and `SET`
- Inline commands (plain text like `PING`, without the array form)
- Nested arrays in the parser
- RESP3 support ( `HELLO 3` handshake and the extra types)

## Credits

- [Coding Challenges: Build Your Own Redis Server](https://codingchallenges.fyi/challenges/challenge-redis/)
- [Redis Serialization Protocol (RESP) specification](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [Redis command documentation](https://redis.io/docs/latest/commands/)

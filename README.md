# Mini-Redis

Mini-Redis is a small Redis-like server written in TypeScript. It implements a subset of Redis commands and RESP2 to explore how a server parses TCP data, executes commands, and returns responses.

## Requirements

- Node.js and npm
- `redis-cli` to connect to the server
- `redis-benchmark` to run the benchmarks

The Redis tools are optional. The server itself uses Node.js built-in modules at runtime.

## Try it out

```bash
git clone https://github.com/DuckFromAPond/Mini-Redis
cd Mini-Redis
npm install
npm start
```

The server listens on port `6379` by default. Pass a port and, optionally, a snapshot path:

```bash
npm start -- 7000
npm start -- 7000 ./custom-dump.json
```

If Redis already uses port `6379`, choose another port. Connect from a second terminal:

```bash
redis-cli -p 7000 PING
# PONG

redis-cli -p 7000 SET drink coffee
# OK

redis-cli -p 7000 GET drink
# "coffee"
```

Other scripts:

```bash
npm run dev    # restart the server when source files change
npm test       # run the test suite
```

## Supported commands

Mini-Redis implements the commands below. Their behavior is similar to Redis, but this project does not implement every Redis option or compatibility detail.

| Command | Syntax | Description |
| --- | --- | --- |
| `PING` | `PING [message]` | Check the connection or return a message. |
| `ECHO` | `ECHO message` | Return the message. |
| `SET` | `SET key value [EX seconds \| PX milliseconds \| EXAT unix-time-seconds \| PXAT unix-time-milliseconds]` | Store a string, optionally with an expiry. |
| `GET` | `GET key` | Return a string, or null if the key does not exist. |
| `EXISTS` | `EXISTS key [key ...]` | Count the keys that exist. |
| `DEL` | `DEL key [key ...]` | Delete keys and return the number removed. |
| `INCR` | `INCR key` | Add one to an integer value. |
| `DECR` | `DECR key` | Subtract one from an integer value. |
| `LPUSH` | `LPUSH key value [value ...]` | Add values to the head of a list. |
| `RPUSH` | `RPUSH key value [value ...]` | Add values to the tail of a list. |
| `LRANGE` | `LRANGE key start stop` | Return a range of list values. |
| `SAVE` | `SAVE` | Write a snapshot to disk. |
| `CONFIG GET` | `CONFIG GET parameter` | Read a supported configuration value. |
| `CONFIG SET` | `CONFIG SET parameter value` | Change a supported runtime setting. |

## Memory limits and eviction

The default `maxmemory` value is `0`, which means unlimited. Use `CONFIG SET` to set a byte limit and choose an eviction policy:

```text
CONFIG GET maxmemory
CONFIG SET maxmemory 100mb
CONFIG SET maxmemory-policy sieve
```

`maxmemory` accepts bytes or `k`/`kb`, `m`/`mb`, and `g`/`gb` suffixes, without regard to letter case. `CONFIG GET maxmemory` returns the limit in bytes.

Mini-Redis supports two policies:

- `noeviction` (default): reject a write that would exceed the limit.
- `sieve`: evict keys using the SIEVE policy until the write fits.

When `maxmemory` is greater than `0`, Mini-Redis tracks an estimated size for each entry:

- A string entry uses the UTF-8 byte lengths of its key and value, plus 50 bytes of fixed overhead.
- A list entry uses the UTF-8 byte length of its key, the combined byte lengths of all list values, and the same 50-byte overhead.

For example, the key `abc` with the string value `coffee` counts as `3 + 6 + 50 = 59` bytes. With the default unlimited setting (`maxmemory 0`), Mini-Redis skips this accounting. The estimate does not include actual JavaScript object, `Map`, allocator, or other Node.js process overhead, so it is not a measurement of heap usage.

Loading a snapshot does not discard entries that exceed the configured limit. With `noeviction`, later writes fail until enough space is freed. With `sieve`, a later write can evict entries to make room. Changing `maxmemory` does not immediately evict entries; the policy applies when a write needs room. Runtime configuration changes are not saved across restarts.

`CONFIG GET` also returns the compatibility values `save` and `appendonly`. `CONFIG SET` supports only `maxmemory` and `maxmemory-policy`.

## Snapshots

`SAVE` writes the store to a JSON snapshot named `dump.json` in the current working directory. The server loads that file when it starts. Pass a different path as the second CLI argument after the port:

```bash
npm start -- 6379 ./data.json
```

The snapshot is written to a temporary file and then renamed into place. Expired entries are omitted. If the file is missing, the server starts with an empty store. If the snapshot is invalid or cannot be read, startup fails with an error that identifies the file and explains how to recover.

Snapshots use this project's JSON format. They are not Redis RDB files and are not compatible with Redis persistence files.

`SAVE` is asynchronous. While it runs, the server queues later data chunks from the same connection so their replies remain in order.

## Protocol and design

Mini-Redis handles RESP2 values used by its command set. It supports simple strings, errors, integers, bulk strings, and arrays. Most clients send commands as arrays of bulk strings.

Each TCP connection buffers incomplete input, so a command can arrive across multiple network chunks. It can also parse multiple commands received together and combine their responses.

```text
client (redis-cli, ioredis)
   │  RESP bytes
   ▼
server.ts
   │  buffer incomplete input; queue later chunks while SAVE runs
   ▼
handleMessages
   ├─ parseCommandBatch / parse
   ├─ handleCommands
   │    └─ Store
   └─ serialize RESP replies
   ▼
client
```

- **Server (`src/server.ts`):** accepts TCP connections, buffers partial commands, and writes responses.
- **Message handling (`src/messages.ts`):** parses input, dispatches commands, and serializes responses. Incomplete RESP input returns to the server for more data.
- **RESP (`src/resp.ts`):** provides a general parser and a fast path for arrays of bulk-string arguments. The general parser handles other supported RESP shapes.
- **Commands (`src/commands.ts`):** maps case-insensitive command names to handlers.
- **Store (`src/store.ts`):** holds strings and lists, tracks expiration and estimated memory use, and applies the configured eviction policy.

## Performance

The measurements below use `redis-benchmark`. Plain runs use `redis-benchmark -t set,get -n 100000 -q`. Pipelined runs use `redis-benchmark -t set,get -n 500000 -P 16 -q`, which sends batches of 16 commands. The latest comparison used the median of three runs. Results vary with machine load.

Historical Mini-Redis measurements were collected at different points during development on the same machine. Treat those rows as context, not as controlled comparisons. Redis and the latest Mini-Redis measurements were also collected on the same machine and done in sucession.

### Plain requests

100,000 requests; default pipeline depth.

| Version | SET (req/s) | GET (req/s) | p50 SET (ms) | p50 GET (ms) |
| --- | ---: | ---: | ---: | ---: |
| Before async changes (`split`/`shift` parser; all commands synchronous) | 76,336 | 80,451 | 0.559 | 0.559 |
| After async changes (every command asynchronous) | 55,772 | 64,062 | 0.823 | 0.823 |
| Partial async and cursor parser (`SAVE` only asynchronous) | 72,727 | 80,321 | 0.735 | 0.735 |
| Redis | 140,449 | 140,845 | 0.183 | 0.183 |
| Latest Mini-Redis | 129,032 | 131,926 | 0.351 | 0.351 |

### Pipelined requests

500,000 requests; pipeline depth 16.

| Version | SET (req/s) | GET (req/s) | p50 SET (ms) | p50 GET (ms) |
| --- | ---: | ---: | ---: | ---: |
| Redis | 1,213,592 | 1,506,024 | 0.591 | 0.463 |
| Mini-Redis, before the batch fast path | 214,041 | 243,902 | 3.527 | 3.135 |
| Latest Mini-Redis, with the batch fast path | 582,750 | 616,522 | 1.471 | 1.407 |

### What the measurements show

- Making every command asynchronous reduced throughput. Ordinary commands are synchronous; `SAVE` is asynchronous.
- Pipelining reduces per-command network overhead by processing multiple commands received together and combining their responses.
- Compared with the earlier pipelined Mini-Redis run, the latest batch-parser run achieved about 2.7 times the SET throughput and 2.5 times the GET throughput. The benchmark runs were not a controlled comparison, so treat these ratios as approximate.
- The latest plain Mini-Redis run reached about 129,000 SET and 132,000 GET requests per second.

### Profiling and the batch parser

A CPU profile (`node --cpu-prof`) during an earlier 500,000-request plain run showed about 75% of profile time in the socket write path and about 17% in parsing. In the optimized `-P 16` run, the profile showed:

| Function | Total time | Self time |
| --- | ---: | ---: |
| `writeUtf8String` | ~45% | ~42% |
| `utf8Slice` | ~12% | ~11% |
| `handleMessages` | ~39% | ~5.6% |
| `parseCommandBatch` | ~22% | ~4.3% |
| `handleCommands` | ~7.4% | ~4.5% |

Total-time percentages include child calls and overlap. Self-time percentages do not. Profiling adds overhead, so treat these values as proportions rather than exact costs.

Most Redis clients encode commands as arrays of bulk strings, such as:

```text
*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n
```

`parseCommandBatch` reads that common form directly from the input buffer. It reads length headers as bytes, avoiding temporary header strings, regular-expression checks, and numeric conversions. It converts argument values to strings and builds the command arrays used by the handlers. Other supported RESP shapes fall back to the general parser.

The fast path duplicates some parsing logic, so it remains limited to the common command shape. In the reported profiles, parsing accounted for about 22% of time in the optimized pipelined run, down from about 47% in the earlier pipelined profile. Socket writing and UTF-8 conversion remain significant costs.

## Limitations

- Mini-Redis implements a small Redis command subset, not the full Redis protocol or command set.
- It does not support RESP3 or inline commands such as plain-text `PING`.
- Memory usage is estimated; it is not an exact measure of process memory.
- Snapshots use a project-specific JSON format. The server does not implement Redis RDB or AOF.
- `CONFIG SET` changes supported settings only for the current server process.

## Future improvements

- Add structured logging for snapshot operations.
- Support inline commands such as plain-text `PING`.
- Add RESP3 support, including `HELLO 3` and its additional data types.

## Credits

- [Coding Challenges: Build Your Own Redis Server](https://codingchallenges.fyi/challenges/challenge-redis/)
- [Redis Serialization Protocol (RESP) specification](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [Redis command documentation](https://redis.io/docs/latest/commands/)
- [SIEVE documentation](https://cachemon.github.io/SIEVE-website/)
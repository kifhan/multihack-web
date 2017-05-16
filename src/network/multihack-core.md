# MultiHack-Core

RemoteManager(opts)

- opts { voice, wrtc, room, hostname, nickname }

## Event

"ready"

### y-multihack connector

"id" { id, nop2p }

"client" client

"voice" { client, socket }

"peers" { peers, mustForward }

- mustForward: num of peers that are nop2p

### Selection

"changeSelection" Selections

- Array of selections

### File System

"createFile" { filePath, content }

"createDir" { filePath }

"deleteFile" { filePath }

### Editor

"changeFile" { filePath, change: { from, to, text } }


## Method

getContent (filePath) -> String

createFile (filePath, contents)

createDir (filePath, contents)

replaceFile (oldPath, newPath)

deleteFile (filePath)

changeFile (filePath, delta)

changeSelection (data)

destroy ()

### Internal Method

_onYTextAdd (filePath, event)

_onLostPeer (peer)

insertChunked(ytext, start, str)

chunkString(str, size)

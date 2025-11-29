# Introduction
`araweb` is a web-based ui for [aranet.py](https://github.com/emheyboer/aranet). With the two running simultaneously, live readings can be viewed remotely from any device.

# Setup
1. Run `aranet.py` with `update = true` and `monitor = true` to add new readings to the sqlite db as they come in
2. Copy `example.env` to `.env` and set each variable (make sure `SQLITE_DB` is pointing to the same file as above)
2. Start `araweb` by running `node server.js`
3. Navigate to `HOSTNAME:PORT` in any web browser

# Output
<img width="25%" height="25%" src=images/mobile.jpg /><img width="50%" height="50%" src=images/desktop.jpg />
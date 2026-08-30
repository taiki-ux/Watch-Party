# watch party — Synced YouTube Watch Party

**watch-party** is a serverless, peer-to-peer web application that lets you watch YouTube videos in real time with friends while chatting over text and voice. Built with pure HTML, CSS, JavaScript, and PeerJS.

## Features

- **Synced Video Playback:** Load any YouTube link or Video ID. Play, pause, seek, and sync video timing instantly across all connected participants.
- **Peer-to-Peer Voice Chat:** Low-latency voice calls using WebRTC and real-time speaking indicators.
- **Live Text Chat:** Built-in room chat with system notifications when users join or leave.
- **No Backend Required:** Powered entirely on the client side using PeerJS public signaling servers for full-mesh data and audio transfer.
- **Responsive UI:** Clean dark-mode interface built for desktop and mobile web browsers.

## Quick Start

1. Open the application URL in your browser.
2. Enter your name and click **Create Room** to generate a unique room code.
3. Share the room code with your friends so they can join.
4. Paste any YouTube URL to start watching together!

## Built With

- **HTML5 / CSS3** — Flexbox/Grid layouts & custom CSS styling
- **JavaScript (ES6+)** — Client-side state & DOM control
- **[PeerJS](https://peerjs.com/)** — WebRTC wrapper for P2P data and voice streaming
- **[YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)** — Video control & playback events

# WIP

This is a cloud-based mp3 player with intricate statistics and running fully in the browser.

## Motivation
1. Modern music streaming services offer a convenient and streamlined listening experience. You can listen to the majority of relevant music wherever you are without downloading anything. But this convenience comes at a cost: Your ability to listen to any given song can be taken away with no recourse. I have had this happen one too many times on songs I enjoyed. 
2. Your listening statistics are valuable. So valuable that most popular streaming providers will only give you proxies for the exact numbers, even when using developer facing tools like their API. I want to know which songs I listened to when and for how long and make arbitrary playlists and graphs based on that.

## Stack
We use a Hono-based backend hosted on Cloudflare Workers together with their D1 database for storing statistics and R2 blob storage for storing the music files. Our frontend is in React, allowing you to run the mp3 player in your browser without downloading anything.

---
title: (Re-)Building Kobink, a Kobo store for my own shelf
date: 2026-11-05
tags:
  - kobo
  - docker
  - selfhosted
slug: kobink
---
My Kobo can only shop at the Kobo store. Everything I already own has to be copied over with a cable, and after the third time I got tired of it. Calibre and calibre-web would have solved that, but I never used Calibre. My books are just files in a folder, and those are the ones I want on the reader.

So I wrote a small server that answers like the store does. It's called Kobink. The protocol work comes from [potatoeggy/kobink](https://github.com/potatoeggy/kobink); I fixed the build, added what I was missing and put it in a container.

## How it works

A Kobo regularly asks its store what it owns, then downloads whatever it is missing. Kobink answers that question with the contents of a directory, so from the reader's side nothing unusual happens. No jailbreak, no patches, no Calibre.

The address you enter on the device contains a key. Everything without the key returns a 404, which is why I can put it behind a reverse proxy without handing out my library.

## Prerequisites

- A machine that runs Docker, a NAS or a small server is enough
- A Kobo that has been set up and connected to the store once
- Your books in a folder, `.epub` or `.kepub.epub`

## Part 1: Server Setup

### 1. The compose file

```bash
mkdir -p /docker/kobink
cd /docker/kobink
nano compose.yaml
```

```yaml
services:
  kobink:
    image: ghcr.io/tswh0/kobink:latest
    container_name: kobink
    restart: unless-stopped
    user: "1000:1000"
    ports:
      - "3000:3000"
    environment:
      PUBLIC_URL: http://192.168.1.10:3000
    volumes:
      - /media/Books:/library:ro
      - ./data:/app/data
```

`PUBLIC_URL` has to be the address the reader will use later. It ends up inside every download link, so a hostname that only the container can resolve won't help.

The image runs as uid 1000. Give it the data folder once, and make sure the library is readable by that user:

```bash
mkdir -p data
chown -R 1000:1000 data
```

### 2. Starting it

```bash
docker compose up -d
docker compose logs kobink
```

The first start generates the key and prints a ready-made endpoint:

```
api key:      <generated on first start>
api_endpoint: http://192.168.1.10:3000/<the key>/kobo
```

## Part 2: The Kobo

### 1. The endpoint

Connect the reader to your computer and edit `.kobo/Kobo/Kobo eReader.conf`:

```ini
[OneStoreServices]
api_endpoint=http://192.168.1.10:3000/PASTE-YOUR-KEY-HERE/kobo
```

Replace the placeholder with the key from the log, eject, press Sync. The path ends at `/kobo`, the device appends `/v1` by itself. If you leave `/v1` in, you get a 404, and the container log tells you so.

> Treat the link like a password. Whoever has it can download every book in the folder.

### 2. When nothing arrives

All books in the folder come over in the first sync, covers included. If the shelf stays empty, watch `docker compose logs -f kobink` while pressing Sync. In my experience it's the URL almost every time, usually a `PUBLIC_URL` that the reader can't reach.

## The browser

The library is also the root of the web UI. Open the same address on a phone or laptop, paste the key, and you get a shelf of covers; tapping one opens the book. EPUBs paginate, KCC books flip page by page. Where you stop on the device is where the browser opens, and a page turned in the browser reaches the device at its next sync. If the two disagree, the book with the most pages read wins.

It's an extension of the Kobo, not a reader of its own: no highlights, notes, dictionary or library management. Add it to a phone's home screen and it opens full screen. A fixed-layout book can be saved from the reading bar and read offline; progress made offline lands on the server at the next open.

## Drop a book

Upload lives at `/drop`: drag EPUB, CBZ or PDF, several at once. EPUB is copied as it is. CBZ and PDF are converted with KCC for the reader you pick, which needs the bigger image and a writable library:

```yaml
image: ghcr.io/tswh0/kobink:conversion
volumes:
  - /media/Books:/library:rw
```

Deleting a book on the reader moves the file into `.kobink-trash/`. `LIBRARY_TRASH=off` deletes it outright.

## Manga and series

Comics I convert with KCC into `.kepub.epub`. KCC writes fixed pages, and if the server tells the Kobo those are normal text books, the reader squeezes them into a column with grey bands above and below. Kobink advertises them as fixed layout, so the page fills the screen the way it did on the computer.

Volumes also arrive as a series. The name comes from the book's metadata, or from the title when there is none, which is what KCC produces: `Fire Punch v03` ends up in a series called Fire Punch as volume 3.

## What I changed from the original

The upstream repository doesn't compile as published and one source file is missing; its download links also point at the author's own domain. I fixed that, then added the key, server-side covers, the fixed-layout flag, series detection, incremental sync and gzip, a browser reader and a drop page. There is no database.

## Notes

- `LIBRARY_REFRESH_SECONDS` sets the rescan interval, `0` turns it off.
- `API_KEY` picks the key yourself instead of the generated one.
- `COVER_CACHE_DAYS` and `TRASH_DAYS` (default 30, `0` keeps forever) prune the cover cache and the trash.
- HTTP on your LAN is fine. Behind a proxy, use HTTPS and keep the link to yourself. Offline copies need HTTPS or localhost; the reader works either way.
- A book that refuses to update can be deleted on the device and synced again.

## Source

The code is at [github.com/tswh0/kobink](https://github.com/tswh0/kobink). AGPL-3.0, like the original.

One container, one folder of books. Happy reading!

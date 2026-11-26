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

So I wrote a small server that answers like the store does. It's called Kobink. The protocol work comes from [potatoeggy/kobink](https://github.com/potatoeggy/kobink), I fixed the build, added what I was missing and put it in a container.

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
    ports:
      - "3000:3000"
    environment:
      PUBLIC_URL: http://192.168.1.10:3000
    volumes:
      - /media/Books:/library:ro
      - ./data:/app/data
```

`PUBLIC_URL` has to be the address the reader will use later. It ends up inside every download link, so a hostname that only the container can resolve won't help.

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

> **Important**: Treat the link like a password. Whoever has it can download every book in the folder.
> {.warning }

### 2. When nothing arrives

All books in the folder come over in the first sync, covers included. If the shelf stays empty, watch `docker compose logs -f kobink` while pressing Sync. In my experience it's the URL almost every time, usually a `PUBLIC_URL` that the reader can't reach.

## Manga and series

Comics I convert with KCC into `.kepub.epub`. KCC writes fixed pages, and if the server tells the Kobo those are normal text books, the reader squeezes them into a column with grey bands above and below. Kobink advertises them as fixed layout, so the page fills the screen the way it did on the computer.

Volumes also arrive as a series. The name comes from the book's metadata, or from the title when there is none, which is what KCC produces: `Fire Punch v03` ends up in a series called Fire Punch as volume 3.

## What I changed from the original

The upstream repository doesn't compile as published, one source file is missing, and the download links point at the author's own domain. Both are fixed here. On top of that:

- a key in the URL, generated on the first start
- covers cut on the server and cached on disk
- the fixed-layout flag for KCC books
- series detection from metadata or title
- incremental sync and gzip, so the tenth sync is a matter of milliseconds
- the folder rescanned every ten minutes
- no database, the SQL dependencies are gone

## Notes

- `LIBRARY_REFRESH_SECONDS` sets the rescan interval, `0` turns it off.
- Set `API_KEY` if you want to choose the key yourself.
- A book that refuses to update can be deleted on the device and synced again.

## Source

There's an install page at [kobink.ewlf.de](https://kobink.ewlf.de) and the code at [github.com/tswh0/kobink](https://github.com/tswh0/kobink). 

One container, one folder, and the shelf fills itself. Happy reading!

---
title: Protecting Your Caddy Reverse Proxy with CrowdSec
date: 2025-12-19
tags:
  - proxy
  - caddy
  - crowdsec
  - security
slug: caddy-crowdsec
---
[CrowdSec](https://www.crowdsec.net/) is an open-source and crowdsourced security engine that analyzes visitor behavior and blocks malicious actors. In this guide, we'll integrate it with [Caddy Reverse Proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy) to automatically detect and block attacks like web scanners, brute force attempts, etc.

## For this you should have

- A Debian-based system
- Root or sudo access
- DNS entry pointed to your IP
- Docker (optional, for attack simulation)

---

## Step 1: Install Caddy (Beta Version)

We need the [beta/testing version of Caddy](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) because the `caddy add-package` command is still experimental in stable releases.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/testing/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-testing-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/testing/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-testing.list

sudo chmod o+r /usr/share/keyrings/caddy-testing-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-testing.list

sudo apt update
sudo apt install caddy
```

---

## Step 2: Install CrowdSec

```bash
sudo apt install crowdsec
```

---

## Step 3: Configure CrowdSec for Caddy

Install the Caddy log parser and generate an API key for the bouncer:

```bash
sudo cscli parsers install crowdsecurity/caddy-logs
sudo cscli bouncers add caddy
```

**Important:** Copy the API key that's displayed.

---

## Step 4: Add the CrowdSec Bouncer to Caddy

```bash
sudo caddy add-package github.com/hslatman/caddy-crowdsec-bouncer
```

This command downloads and rebuilds Caddy with the CrowdSec bouncer module included.

---

## Step 5: Configure Your Caddyfile

Edit your Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with:

```text
(logging) {
	log {
		output file /var/log/caddy/access.log {
			roll_size 10MiB
			roll_keep 0
		}
	}
}

{
	crowdsec {
		api_key YOUR_CROWDSEC_API_KEY
		api_url http://localhost:8080/
		ticker_interval 15s
	}
}

example.com {
	import logging
	route {
		crowdsec
	}
	respond "Hello, World!" 200
}
```

Replace `YOUR_CROWDSEC_API_KEY` with the key from Step 3, and `example.com` with your actual domain for testing.

---

## Step 6: Configure CrowdSec to Read Caddy Logs

Edit the CrowdSec acquisition config:

```bash
sudo nano /etc/crowdsec/acquis.yaml
```

Add the following at the end of the file:

```yaml
---
filenames:
  - /var/log/caddy/access.log
labels:
  type: caddy
---
```

---

## Step 7: Reload both Services

```bash
sudo systemctl reload crowdsec && sudo systemctl restart caddy
```

---

## Verifying the Installation

### Check Caddy Modules

```bash
caddy list-modules | grep crowdsec
```

Expected output:

```text
admin.api.crowdsec
crowdsec
http.handlers.crowdsec
layer4.matchers.crowdsec
```

### Check Bouncer Connection

```bash
sudo cscli bouncers list
```

You should see your bouncer with a recent "Last API Pull" timestamp.

---

## Testing CrowdSec

### Manual Ban Test

Ban your own IP temporarily:

```bash
sudo cscli decisions add -i YOUR_IP --type ban --reason "manual test"
```

Now try visiting your domain—you should be blocked. Remove the ban with:

```bash
sudo cscli decisions delete -i YOUR_IP
```

### Simulate an Attack with [Nikto](https://houdini.secsi.io/tool/nikto)

Run a web vulnerability scanner against your server:

```bash
docker run --rm secsi/nikto -h https://example.com -Tuning 9
```

After a few seconds, check if CrowdSec detected and banned the scanner:

```bash
sudo cscli decisions list
```

You should see output similar to:

```text
│ ID    │ Source   │ Scope:Value     │ Reason                                │ Action │ Country │ AS │ Events │ expiration         │ Alert ID │
│ 15004 │ crowdsec │ Ip:YOUR_IP      │ crowdsecurity/http-crawl-non_statics  │ ban    │         │    │ 44     │ 3h33m34s           │ 5        │
```

---

## Conclusion

Your Caddy server is now protected by CrowdSec! The system will automatically detect and block common attack patterns like:

- Aggressive crawlers
- Vulnerability scanners
- Brute force attempts
- Path traversal attacks

CrowdSec also shares threat intelligence with its community, meaning your server benefits from attacks detected by other users worldwide.

### Useful Commands

| Command                             | Description               |
| ----------------------------------- | ------------------------- |
| `sudo cscli decisions list`         | View active bans          |
| `sudo cscli alerts list`            | View recent alerts        |
| `sudo cscli decisions delete -i IP` | Unban an IP               |
| `sudo cscli metrics`                | View detection statistics |
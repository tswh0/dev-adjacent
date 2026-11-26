---
title: "Generating a Wildcard Cert Manually to Use with Caddy"
date: 2026-04-17
tags:
  - caddy
  - networking
  - reverse-proxy
  - tls
slug: manual-wildcard-cert
---
If you're already running Caddy this is how to manually generate a tls certificate if you don't use a common DNS provider like Cloudflare. For this you only need to create a txt DNS entry to verify your domain with certbot.

## 1. Install Certbot

```bash
sudo apt install certbot
```

## 2. Generate the Wildcard Certificate

This example generates a single cert for both the root domain `example.com` and the wildcart `*.example.com`. Run:

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d "example.com" -d "*.example.com"
```

Follow the prompts to create the required DNS TXT records. If you've set up `acme-dns`, you can automate this with the appropriate auth hooks instead.

Your new certificate will be stored at:

```text
/etc/letsencrypt/live/example.com/
```

## 3. Fix Permissions for Caddy

Caddy needs access to read the certificates:

```bash
sudo chgrp -R caddy /etc/letsencrypt
sudo chmod -R 750 /etc/letsencrypt
```

## 4. Update Your Caddyfile

Point Caddy at the new certificate for the root domain and wildcard block:

```Caddyfile
*.example.com, example.com {
    tls /etc/letsencrypt/live/example.com/fullchain.pem \
        /etc/letsencrypt/live/example.com/privkey.pem

    # your site config here
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

## 5. Automate Renewal

Add a cron job so certificates renew automatically and Caddy picks up the changes:

```bash
#Edit crontab with
crontab -e

#Add this line
0 0,12 * * * certbot renew --quiet --deploy-hook "chgrp -R caddy /etc/letsencrypt && chmod -R 750 /etc/letsencrypt && systemctl reload caddy"
```

That's it, your root domain and all its subdomains are now served over HTTPS with a single auto-renewing wildcard certificate.

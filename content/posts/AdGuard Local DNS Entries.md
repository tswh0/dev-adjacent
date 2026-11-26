---
title: "AdGuard Home: Setting Up Local DNS Entries with DNS Rewrite"
date: 2025-02-05
tags:
  - networking
  - docker
  - dns
slug: adguard-dns
---
[AdGuard Home](https://adguard.com/) is a network-wide ad blocker that doubles as a powerful DNS server. I've been running an local instance for years, it's proven to be incredibly reliable and stable. Beyond the ad blocking, the most important feature for me is the use of AGH as a DNS server, allowing me to use friendly domain names for local services instead of memorizing IP's.

This guide covers installation via Docker and Docker Compose, plus how to configure local DNS entries using AdGuard Home's DNS Rewrite feature.

## Installation Options

### Option 1: Docker Run Command

**Step 1:** Create the directory structure for persistent data (I'm using a docker folder in my root with subfolders for all my stacks):
```bash
mkdir -p /docker/adguard/work /docker/adguard/conf
```

**Step 2:** Run the container:
```bash
docker run -d \
  --name adguardhome \
  --restart unless-stopped \
  -p 53:53/tcp -p 53:53/udp \
  -p 80:80/tcp -p 443:443/tcp -p 3000:3000/tcp \
  -v /docker/adguard/work:/opt/adguardhome/work \
  -v /docker/adguard/conf:/opt/adguardhome/conf \
  adguard/adguardhome
```

### Option 2: Docker Compose

**Step 1:** Create the directory structure:
```bash
mkdir -p /docker/adguard
cd /docker/adguard
```

**Step 2:** Create a `docker-compose.yml` file:
```yaml
services:
  adguardhome:
    image: adguard/adguardhome
    container_name: adguardhome
    restart: unless-stopped
    ports:
      - "53:53/tcp"     # DNS over TCP
      - "53:53/udp"     # DNS over UDP
      - "80:80/tcp"     # HTTP web interface
      - "443:443/tcp"   # HTTPS web interface
      - "3000:3000/tcp" # Initial setup
    volumes:
      - ./work:/opt/adguardhome/work
      - ./conf:/opt/adguardhome/conf
    environment:
      - TZ=Europe/Berlin  # Set your timezone
```

**Step 3:** Deploy the container:
```bash
docker-compose up -d
```

## Initial Configuration

Regardless of your installation method:

1. **Complete initial setup:** Visit `http://your-server-ip:3000` in your browser
2. **Follow the setup wizard:** Configure admin credentials and basic settings
3. **Access the dashboard:** Once setup is complete, access AdGuard Home at `http://your-server-ip`

> **Note:** Port 3000 is only needed during initial setup and can be removed afterward.

4. **Setup AdGuard Home as DNS Server:** Now you need to setup AdGuard as the local DNS Server on your Network. You can do this per device or network wide on your router. AdGuard Home provides documentation for that during the setup.

## Configuring Local DNS with DNS Rewrite

### Adding DNS Rewrites

1. **Navigate to the DNS Rewrites section:**
   - Go to **Filters → DNS Rewrites** in the AdGuard Home dashboard

2. **Add your entries:**
   - Click "Add DNS rewrite"
   - Enter domain name (e.g., `nas.local`)
   - Enter IP address (e.g., `192.168.1.100`)
   - Click "Save"

3. **Example entries:**
   ```
   nas.local                → 192.168.1.100
   plex.local               → 192.168.1.101
   *.dev.local              → 192.168.1.50
   home-assistant.local     → 192.168.1.102
   ```

### Wildcard Examples

DNS Rewrite supports wildcard patterns. Examples:

- `*.local` → Routes all subdomains to the same IP (for example a local reverse proxy like [caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy))
- `*.dev.local` → For development environments  
- `*.k8s.local` → For Kubernetes ingress routing

## Troubleshooting: Router DNS Protection

**Important:** Many modern routers include DNS security features like the ones listed below that can interfere with local DNS rewrites:

- **DNS Rebind Protection**
- **DNS Hijacking Protection** 
- **DNS Spoofing Prevention**
- **Private IP Response Filtering**

To circumvent this:

1. **Check router settings:** Look for the security features mentioned above
2. **Whitelist your AdGuard server:** Add your AdGuard server's IP to allowed lists
3. **Disable for local domains:** Configure exceptions for your local domain names (e.g., `*.local`)
4. **Test connectivity:** On a network client use `nslookup` or `dig` to verify DNS resolution is working

```bash
# Test DNS resolution
nslookup nas.homelab.local your-adguard-ip

# Alternative test with dig
dig @your-adguard-ip nas.homelab.local
```
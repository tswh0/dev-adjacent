---
title: How to Build a Bulletproof Torrent Setup - with a VPS, OpenVPN and qBittorrent
date: 2025-10-29
tags:
  - networking
  - docker
  - torrent
slug: torrent-vps
---
# Building a Secure Torrent Setup with Docker, OpenVPN, and a VPS

## Why You Need This

If you live in Germany, the UK, or other countries with aggressive copyright enforcement, torrenting without protection is a fast track to expensive legal notices. Commercial VPNs often lack port forwarding, share exit nodes with thousands of users, and can leak your IP when they disconnect.

The solution? Roll your own VPN on a VPS in a privacy-friendly jurisdiction. You get full control, dedicated IP, proper port forwarding, and a reliable kill switch.

## Prerequisites

- A VPS in a copyright-relaxed country (e.g. Romania, Bosnia, Bulgaria, Poland). **Do your own research!**
- When possible choose one with KVM virtualization, not OpenVZ
- Basic Linux command line knowledge
- A Home Server with Docker installed

## Part 1: VPS Setup with OpenVPN

### Why OpenVPN?

While WireGuard is faster, OpenVPN works on any VPS type, including budget providers with restricted kernels. For torrenting I think the performance difference is negligible.

### Installation

SSH into your VPS and run the [automated installer](https://github.com/Nyr/openvpn-install):

```bash
wget https://git.io/vpn -O openvpn-install.sh
chmod +x openvpn-install.sh
./openvpn-install.sh
```

The script will:
- Install and configure OpenVPN server
- Generate certificates and keys
- Set up firewall rules and routing
- Create a client configuration file

Download or copy the generated `.ovpn` file to your home server.

## Part 2: Docker Setup at Home

### The Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
services:
  openvpn:
    image: dperson/openvpn-client
    container_name: openvpn
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun
    volumes:
      - ./vpn.ovpn:/vpn/vpn.ovpn:ro  # Location of the copied ovpn file
    command: '-f ""'
    ports:
      - 8080:8080      # qBittorrent WebUI
      - 6881:6881      # BitTorrent port
      - 6881:6881/udp
    restart: unless-stopped

  qbittorrent:
    image: linuxserver/qbittorrent
    container_name: qbittorrent
    network_mode: "service:openvpn"  # Kill switch via network isolation
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Berlin
      - WEBUI_PORT=8080
    volumes:
      - ./qbittorrent/config:/config
      - ./downloads:/downloads
    depends_on:
      - openvpn
    restart: unless-stopped
```

### Understanding the Kill Switch

The key line is `network_mode: "service:openvpn"`. This binds qBittorrent to the OpenVPN container's network namespace, meaning:

- qBittorrent can only access the internet through the VPN
- If OpenVPN fails, qBittorrent loses all network access
- No traffic can leak to your home IP

### Start the Stack

```bash
docker-compose up -d
```

Access qBittorrent at `http://[Home-Server-IP]:8080`

The default credentials get created on startup of the qBittorrent container. You can see them in the logs with 

```bash
docker logs qbittorrent
```
## Part 3: Verification

### Check IP Leakage

```bash
# Your actual home IP
curl ifconfig.me

# qBittorrent's IP (should show VPS IP)
docker exec qbittorrent curl ifconfig.me
```

These should be different. If they match, troubleshoot before downloading anything.

### Test the Kill Switch

On your VPS, stop OpenVPN:

```bash
systemctl stop openvpn-server@server
```

From home, test connectivity:

```bash
docker exec qbittorrent curl --max-time 5 ifconfig.me
```

This should timeout or fail. If it shows your home IP, the kill switch isn't working properly.

Restart OpenVPN:

```bash
systemctl start openvpn-server@server
```

## Part 4: Port Forwarding

Port forwarding is essential for good torrent speeds. Without it, you'll only connect to peers who have forwarded ports. How to open the ports depends on your system and VPS provider. Here some examples:

### Method 1: Standard iptables (on a KVM VPS)

On your VPS, find your client's VPN IP:

```bash
cat /var/log/openvpn/openvpn-status.log
```

Set up forwarding (replace `10.8.0.6` with your client IP and `eth0` with your interface):

```bash
# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# Forward port 6881
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 6881 -j DNAT --to-destination 10.8.0.6:6881
iptables -t nat -A PREROUTING -i eth0 -p udp --dport 6881 -j DNAT --to-destination 10.8.0.6:6881

# Allow forwarding
iptables -A FORWARD -i eth0 -o tun0 -p tcp --dport 6881 -j ACCEPT
iptables -A FORWARD -i eth0 -o tun0 -p udp --dport 6881 -j ACCEPT

# Save rules
apt install iptables-persistent
netfilter-persistent save
```

### Method 2: SOCAT (OpenVZ VPS)

If you get errors about DNAT not being supported, your kernel lacks NAT modules. Use `socat` instead:

```bash
apt install socat
```

Create systemd services for TCP and UDP:

**TCP:** `/etc/systemd/system/port-forward-6881-tcp.service`

```ini
[Unit]
Description=Port Forward 6881 TCP
After=network.target openvpn-server@server.service

[Service]
Type=simple
ExecStart=/usr/bin/socat TCP-LISTEN:6881,fork,reuseaddr TCP:10.8.0.6:6881
Restart=always

[Install]
WantedBy=multi-user.target
```

**UDP:** `/etc/systemd/system/port-forward-6881-udp.service`

```ini
[Unit]
Description=Port Forward 6881 UDP
After=network.target openvpn-server@server.service

[Service]
Type=simple
ExecStart=/usr/bin/socat UDP-LISTEN:6881,fork,reuseaddr UDP:10.8.0.6:6881
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable --now port-forward-6881-tcp port-forward-6881-udp
```

### Test Port Forwarding

Check if the port is accessible from the internet:

```bash
# From another machine
nc -zv YOUR_VPS_IP 6881
```

Or use an online port checker: https://www.yougetsignal.com/tools/open-ports/

## Part 5: Blocking Peer Countries (Optional)

To avoid connecting to peers in copyright-aggressive countries, use IP blocklists.

### Download Country IP Ranges

```bash
mkdir ~/blocklists && cd ~/blocklists

# Download German for example
wget https://www.ipdeny.com/ipblocks/data/countries/de.zone
wget https://www.ipdeny.com/ipblocks/data/countries/[other country-code].zone

cat de.zone [other country-code].zone > blocked-countries.txt
```

### Convert to P2P Format

Create `convert-to-p2p.py`:

```python
#!/usr/bin/env python3
import ipaddress

with open('blocklist.p2p', 'w') as out:
    out.write("# Blocked Countries\n")
    
    with open('blocked-countries.txt', 'r') as inp:
        for line in inp:
            line = line.strip()
            if not line:
                continue
            
            network = ipaddress.ip_network(line)
            start = str(network.network_address)
            end = str(network.broadcast_address)
            out.write(f"Blocked:{start}-{end}\n")

print("Blocklist created!")
```

Run it:

```bash
chmod +x convert-to-p2p.py
python3 convert-to-p2p.py
```

Alternatively you can do the same a bash script:

```bash
#!/bin/bash
# convert-to-p2p.sh

INPUT="blocked-countries.txt"
OUTPUT="blocklist.p2p"

echo "# Blocked Countries: DE, BA" > $OUTPUT

while IFS= read -r cidr; do
    # Convert CIDR to range (you need ipcalc)
    apt install ipcalc -y
    RANGE=$(ipcalc -r $cidr | grep -oP '(?<=HostMin:   ).*(?=   HostMax:)|(?<=HostMax:   ).*')
    START=$(echo $RANGE | awk '{print $1}')
    END=$(echo $RANGE | awk '{print $2}')
    
    echo "Blocked:$START-$END" >> $OUTPUT
done < $INPUT

echo "Done! Output: $OUTPUT"
```

### Add to qBittorrent

```bash
docker cp blocklist.p2p qbittorrent:/config/
```

In qBittorrent WebUI:
1. Options → Connection
2. Enable "IP Filtering"
3. Set path to `/config/blocklist.p2p`
4. Save and restart

### Automate Updates

Create `update-blocklist.sh`:

```bash
#!/bin/bash
cd /path/to/blocklists

wget -q https://www.ipdeny.com/ipblocks/data/countries/de.zone -O de.zone
cat de.zone > blocked-countries.txt
python3 convert-to-p2p.py
docker cp blocklist.p2p qbittorrent:/config/
docker restart qbittorrent

echo "Blocklist updated: $(date)"
```

Add to crontab for weekly updates:

```bash
crontab -e
# Add: 0 3 * * 0 /path/to/update-blocklist.sh
```

## Troubleshooting

### Torrents Won't Start

```bash
# Check OpenVPN connection
docker logs openvpn

# Test internet connectivity
docker exec qbittorrent ping -c 4 8.8.8.8
```

### Poor Download Speeds

- Verify port 6881 is forwarded and open
- Check VPS bandwidth limits
- Ensure you're using a geographically reasonable VPS location

### IP Leaking

```bash
# Comprehensive IP check
docker exec qbittorrent curl ipinfo.io
docker exec qbittorrent curl icanhazip.com
```

All should show your VPS IP, not your home IP.

## Summary

This setup provides:

- **Full IP masking** through your VPS
- **Reliable kill switch** via Docker network isolation
- **Port forwarding** for optimal speeds and seeds
- **Country-based peer blocking** for additional protection
- **Complete control** over your VPN infrastructure

**Monthly cost:** ~€5 for a VPS  
**Legal notices received:** 0

This approach is significantly more reliable than commercial VPNs for torrenting, with the added benefit of learning useful Docker and networking skills.

---

**Disclaimer:** This guide is for educational purposes. Ensure you only download content you have legal rights to access. The author is not responsible for misuse of this information.
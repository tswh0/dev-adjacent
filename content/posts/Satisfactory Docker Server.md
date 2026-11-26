---
title: Hosting Your Own Satisfactory Game Server with Docker
date: 2025-09-23
tags:
  - docker
  - gaming
slug: satisfactory-server
---
Tired of your factory grinding to a halt every time your friend decides to log off? It's time to take control and host your own Satisfactory dedicated server! You can transform any spare machine into a factory-powering beast that keeps your conveyor belts humming around the clock. No more "host has disconnected" messages ruining your perfectly timed production chains. Your AWESOME Shop will thank you, and so will your fellow pioneers who can now obsess over efficiency ratios at 3 AM without bothering anyone.

## 1. Server Docker Setup

The easiest way to get started is using the `wolveix/satisfactory-server` Docker image. Create a `docker-compose.yml` file with the following configuration:

```yaml
services:
  satisfactory-server:
    container_name: 'satisfactory-server'
    hostname: 'satisfactory-server'
    image: 'wolveix/satisfactory-server:latest'
    ports:
      - '7777:7777/tcp'
      - '7777:7777/udp'
      - '8888:8888/tcp'
    volumes:
      - './satisfactory-server:/config'
    environment:
      - MAXPLAYERS=4
      - PGID=1000
      - PUID=1000
      - STEAMBETA=false
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 12G
        reservations:
          memory: 4G
```

This setup allocates 4-12GB of RAM and supports up to 4 players. Adjust `MAXPLAYERS` and memory limits based on your needs and server capabilities.

If you don't want external access you can skip step 2. and start the server with:
```bash
docker-compose up -d
```

## 2. Making Your Server Externally Accessible

### Option A: Tailscale (Recommended)

Tailscale creates a secure mesh network between your devices. Add this service to your compose file:

```yaml
services:
  satisfactory-server:
    # ... (same as above)
  
  tailscale:
    image: tailscale/tailscale:latest
    container_name: tailscale-satisfactory
    hostname: satisfactory
    environment:
      - TS_AUTHKEY=[INSERT-AUTH-KEY-HERE]
      - TS_STATE_DIR=/var/lib/tailscale
    volumes:
      - ./config:/config
      - ./ts-state:/var/lib/tailscale
    devices:
      - /dev/net/tun:/dev/net/tun
    cap_add:
      - net_admin
```

After deployment, your server will appear in the Tailscale dashboard and be accessible via its Tailscale IP address on port 7777 to all devices in your Tailnet.

### Option B: playit.gg

For a simpler setup without requiring client software installation, but possibly a higher latency:

```yaml
services:
  satisfactory-server:
    # ... (same as above)
  
  playit:
    image: ghcr.io/playit-cloud/playit-agent:latest
    network_mode: host
    environment:
      - SECRET_KEY=[INSERT-AUTH-KEY-HERE]
```

Configure port forwarding through the playit.gg dashboard after the container starts.

## 3. Importing Existing Save Files

To continue an existing game on your dedicated server, the [offical wiki entry](https://satisfactory.fandom.com/wiki/Dedicated_servers#Loading_a_save_file) states:

1. **Find your save file and Session Name** in the Load tab of Satisfactory's main menu
2. **Locate the save file** on your local machine:
   - Linux: `~/.config/Epic/FactoryGame/Saved/SaveGames`
   - Windows: `%LOCALAPPDATA%\FactoryGame\Saved\SaveGames`
3. **Copy the .sav file** to `./satisfactory-server/Epic/FactoryGame/Saved/SaveGames/server`
4. **Enter the Session Name** in the Server Manager settings and press Enter

The server will automatically search for and load the matching save file.

---
## Alternative Solutions

### FRP (Fast Reverse Proxy)

For more control over your tunneling solution, consider [FRP](https://github.com/fatedier/frp):

**VPS Configuration** (`frps.ini`):
```ini
[common]
bind_port = 7000       # control channel
bind_udp_port = 7777   # game traffic
```

**Home Server Configuration** (`frpc.ini`):
```ini
[common]
server_addr = your.vps.ip
server_port = 7000

[sat_udp]
type = udp
local_ip = 127.0.0.1
local_port = 7777
remote_port = 7777

[sat_tcp]
type = tcp
local_ip = 127.0.0.1
local_port = 7777
remote_port = 7777
```

After starting FRP and opening the respective ports the server should now the accessible at yor.vps.ip:7777.
### WireGuard + iptables

For advanced users familiar with WireGuard:

1. Set up a persistent WireGuard tunnel to your VPS
2. Configure port forwarding on the VPS:
   ```bash
   iptables -t nat -A PREROUTING -p udp --dport 7777 -j DNAT --to 10.0.0.2:7777
   ```

This approach offers minimal latency overhead while providing secure remote access.

---

Congratulations, Pioneer! You've just unlocked the ultimate factory expansion: a dedicated server that never sleeps, never crashes, and never complains about your spaghetti belt layouts. Your friends can now join your industrial empire any time they want, and that beautiful nuclear power plant you spent 12 hours perfecting will keep humming along even when you're dreaming about optimal ratios.

Happy rebuilding! 🏭⚡
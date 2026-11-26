---
title: "Embracing the Inevitable: Using IPv6 with Docker"
date: 2025-03-04
tags:
  - docker
  - networking
  - ipv6
slug: docker-ipv6
---
In today's increasingly connected world, the transition from IPv4 to IPv6 is no longer optional but essential. With IPv4 addresses essentially exhausted and [CGNAT](https://de.wikipedia.org/wiki/Carrier-grade_NAT) being the default for most home Internet providers, containers and microservices need to embrace IPv6 to ensure seamless connectivity in modern networks. Here's how to get Docker working properly with IPv6 on Linux systems.

The Docker ecosystem was originally built around IPv4, but as global IPv6 adoption increases, running containers with only IPv4 connectivity creates unnecessary technical debt. Modern applications need to be IPv6-ready, especially in cloud environments where dual-stack networking is becoming standard.

## Enabling IPv6 in Docker

Configuring Docker to work with IPv6 is straightforward once you understand the process. We are going to
- Prep Docker for IPv6 
- Create a IPv6 Network and add a test container with the network.
- Test IPv6

### 1. Configure the Docker Daemon

Start by editing your Docker daemon configuration file (`/etc/docker/daemon.json`):

```json
{
  "ipv6": true,
  "fixed-cidr-v6": "fd00::/64"
}
```

After saving these changes, restart the Docker daemon:

```bash
sudo systemctl restart docker
```

### 2. Create IPv6-Enabled Networks

For better isolation and control, create custom networks with IPv6 enabled. By default Docker will still only use IPv4 for the Docker-Networks.

```bash
docker network create --ipv6 --subnet fd00:1::/64 --gateway fd00:1::1 ipv6_network
```

### 3. Launch Containers on Your IPv6 Network

Now you can run containers that automatically receive IPv6 addresses:

```bash
docker run --name whoami --network ipv6_network -d -p 8023:80 traefik/whoami
```

To verify that your container has an IPv6 address:

```bash
docker inspect whoami | grep IPv6Address
```

```bash
curl http://localhost:456
``` 

Curl should also output the IPv6 Adress of your local machine:

```txt
Hostname: 3f2fc2a87b75
IP: 127.0.0.1
IP: ::1
IP: 172.20.0.2
IP: fd00:1::2
IP: fe80::500b:4fff:feda:594a
RemoteAddr: 172.20.0.1:42410
GET / HTTP/1.1
Host: localhost:456
User-Agent: curl/7.88.1
Accept: */*
```

## Common Problems

**Container-to-internet connectivity**
Ensure IPv6 forwarding is enabled on your host system with:
```bash
sysctl -w net.ipv6.conf.all.forwarding=1
```

**Network conflicts**
Use distinct ULA (Unique Local Address) prefixes for different networks to avoid subnet overlaps.

**Migration**
You cannot modify existing networks to add IPv6. Instead, create new IPv6-enabled networks and migrate containers as needed.
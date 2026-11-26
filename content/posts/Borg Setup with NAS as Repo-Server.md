---
title: Setting Up a Borg Backup with Borgmatic and a Docker Container as Repo-Server
date: 2024-12-22
tags:
  - backup
  - docker
  - borg
slug: borg-backup
---
In this guide, I'll walk you through setting up a Borg backup server using Docker, along with configuring a client with Borgmatic for automated backups. This setup provides a robust, encrypted backup solution that can be automated with minimal maintenance.

## Prerequisites

- A backup-server
- The to be backed up client machine with SSH access
- Basic understanding of Linux commands
- [Docker and Docker Compose](https://docs.docker.com/engine/install/) installed on the server

## Part 1: Server Setup

### 1. Creating the Borg Server Docker Container

First, create a directory and compose file for the Borg Server configuration:

```bash
mkdir -p /docker/borg-server 
cd /docker/borg-server
nano docker-compose.yaml
```

Add the following configuration to your `compose.yaml`:

```yaml
services:
  borg:
    image: horaceworblehat/borg-server
    restart: unless-stopped
    environment:
      BORG_UID: "1000" #change depending to your needs
      BORG_GID: "1000"
    volumes:
      - ./Backups:/home/borg/backups #change this to your backup location
      - ./server_keys:/var/lib/docker-borg
      - ./authorized_keys:/home/borg/.ssh/authorized_keys
    ports:
      - 8022:22
```

### 2. Setting Up SSH Authentication

Before starting the container, you need to set up SSH authentication:

1. On your **client** machine, get your public SSH key:
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```
If you don't have a SSH key you can create one with ```ssh-keygen```

2. On the **server**, create the authorized_keys file:
   ```bash
   nano /docker/borg-server/authorized_keys
   ```
   Paste your client's public SSH key into this file.

### 3. Testing the Connection

Start the container with ```docker-compose up -d``` and test the SSH connection:

```bash
ssh borg@[SERVER_ADDRESS] -p 8022
```

## Part 2: Client Setup

### 1. Installing Required Software

Install [Borg](https://www.borgbackup.org/) and [Borgmatic](https://torsion.org/borgmatic/how-to/set-up-backups/) on your client machine:

```bash
apt update && apt upgrade -y
apt install -y borgbackup
apt install pipx -y
pipx install borgmatic
```

Verify the installation:

```bash
borg -V
borgmatic --version
```

### 2. Configuring Borgmatic

Generate and edit the Borgmatic configuration:

```bash
borgmatic config generate &&
nano /etc/borgmatic/config.yaml
```

Use this template for your configuration:

```yaml
source_directories:
    - /[YOUR-WANTED-BACKUPS]
    - /[YOUR-WANTED-BACKUPS]
repositories:
    - path: ssh://borg@[SERVER_ADDRESS]:8022/home/borg/backups/[HOSTNAME]
      label: backup-server
exclude_caches: true
keep_exclude_tags: false
exclude_if_present:
    - .nobackup
encryption_passphrase: [YOUR_SECURE_PASSPHRASE] #generate long passphrase
checkpoint_interval: 300
archive_name_format: "[HOSTNAME]-{now:%Y%m%d_%H%M}"
keep_weekly: 2
keep_monthly: 3
# i'm using apprise as notifications, you can setup others as decriped here or leave it out  https://torsion.org/borgmatic/docs/how-to/monitor-your-backups/
```

### 3. Initializing the Repository

Validate your configuration and initialize the repository:

```bash
borgmatic config validate
borgmatic -v2 init -e repokey
```

### 4. Backing Up the Repository Key

Export and save your repository key:

```bash
ssh borg@[SERVER_ADDRESS] -p 8022
borg key export /home/borg/backups/[HOSTNAME]
```

>**Important**: Store this key securely! You will need it for disaster recovery. You will also need your encryption_passphrase set in the config.yaml to access the backups. **SAVE BOTH**
> {.warning }
### 5. Testing Your Setup

Perform a dry run to verify your configuration:

```bash
borgmatic -v2 --dry-run
```

## Part 3: Cron Automation

### 1. Creating the Backup Script

Create a script to run your backups:

```bash
nano /etc/borgmatic/borg.sh
```

Add the following content:

```bash
#!/bin/bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.local/bin
borgmatic \
    prune create check compact \
    --stats
```

Make the script executable:

```bash
chmod +x /etc/borgmatic/borg.sh
```

### 2. Setting Up the Cron Job

Add the backup script to your crontab:

```bash
crontab -e
```

Add this line to run the backup daily at 4:30 AM:

```
30 4 * * * /etc/borgmatic/borg.sh
```

## Security Considerations

- Use strong encryption passphrases
- Keep your repository keys in a secure location
- Regularly test your backup restoration process
- Monitor backup notifications for failures

## Conclusion

You now have a fully automated, secure backup system using Borg and Docker. Remember to regularly test your backups by attempting to restore files to ensure your backup strategy is working as intended.

Safe hosting!


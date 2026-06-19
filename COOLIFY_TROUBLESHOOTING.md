# Coolify Deployment: Disk Space Error (ENOSPC)

## Problem
Docker build fails with:
```
npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device, write
ERROR: process "/bin/bash -ol pipefail -c npm install" did not complete successfully: exit code: 1
```

This means the VPS disk is full (usually 95%+) and Docker cannot write during `npm install`.

## Solution (Step by Step)

**👉 GUIDED MODE: Send the command output after each step and I'll give you the next one.**

### Step 1: SSH into VPS
```bash
ssh root@185.201.8.71
```
Run this and let me know when you're connected.

### Step 2: Check disk usage
```bash
df -h /
```
Run this and paste the output. If `Use%` is 90%+, we proceed to cleanup.

### Step 3: Check Docker disk usage
```bash
docker system df
```
Run this and paste the output. Note how much space is in Images (reclaimable) and Build Cache.

### Step 4: Clear Docker build cache (SAFE)
```bash
docker builder prune -a -f
```
This frees build cache without affecting running containers.
- **Expected result:** 4-20GB freed
- Run and paste the output showing total reclaimable space.

### Step 5: Clear unused Docker images (SAFE)
```bash
docker image prune -a -f
```
This removes images not used by any running container. They will be re-pulled if needed.
- **Expected result:** 20-30GB freed
- **Warning:** First build after this may take longer as images are re-downloaded
- Run and paste the output showing total reclaimed space.

### Step 6: Verify space freed
```bash
df -h /
```
Run this and paste the output. Target: at least 20% free space (ideal: 30-40%).

### Step 7: Clean apt cache (OPTIONAL, minor gain)
```bash
apt-get clean
```
Frees ~100-200MB of package cache.

### Step 8: Redeploy from Coolify
Go to Coolify dashboard → your application → trigger a new deployment.
Paste the deployment link or let me know when it's done.

## Quick Reference
- **VPS IP:** `185.201.8.71`
- **Safe to delete:** Unused Docker images, build cache, apt cache
- **DO NOT delete:** `/var/lib/docker/volumes/` (app data), running containers

## When to Clean
- Before: Deployment fails with `ENOSPC`
- Preventive: Run monthly if VPS is 80%+ full
- After: Check `df -h /` — should be 45% or lower

## If Still Failing After Cleanup
1. Check `docker ps` — ensure Coolify container is running
2. Increase VPS disk size (contact Hostinger)
3. Verify `.dockerignore` exists in repo (reduces build context)

---
title: Detecting hostPath Volume Mounts
description: Identifying dangerous volume mounts that expose host filesystem to containers
category: offensive
impact: Critical - Container escape allows attackers to break out of container isolation and access the underlying host, enabling complete node compromise
mitigation: Use Pod Security Standards to block privileged containers, implement Seccomp and AppArmor profiles, run containers as non-root, and drop all unnecessary Linux capabilities
mitreTechniques:
  - T1611
  - T1068
tools:
  - falco
  - kube-bench
  - trivy
references: |
  - [Container Escape Techniques](https://blog.trailofbits.com/2019/07/19/understanding-docker-container-escapes/) - Understanding container escape vectors
  - [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) - Kubernetes Pod Security Standards
---

Container escape is a technique where an attacker breaks out of a container's isolation to access the underlying host system. This is one of the most critical attack vectors in container security.

## How Container Escape Works

Containers rely on Linux kernel features for isolation:

- **Namespaces** - Isolate process IDs, network, users, etc.
- **Cgroups** - Limit resource usage
- **Seccomp** - Restrict system calls
- **Capabilities** - Limit root powers

Container escape exploits weaknesses in these isolation mechanisms.

## Common Escape Vectors

### 1. Privileged Containers

Privileged containers have all Linux capabilities and access to host devices:

```bash
# Inside a privileged container, mount the host filesystem
mount /dev/sda1 /mnt
chroot /mnt
```

### 2. Dangerous Volume Mounts

Mounting sensitive host paths enables escape:

```yaml
# Dangerous: Mounting Docker socket
volumes:
- /var/run/docker.sock:/var/run/docker.sock

# Dangerous: Mounting host root
volumes:
- /:/host
```

### 3. Kernel Exploits

Vulnerabilities in the Linux kernel can be exploited from within containers:

```bash
# Example: CVE exploits targeting the kernel
# Dirty COW, OverlayFS exploits, etc.
```

### 4. CAP_SYS_ADMIN Abuse

The `CAP_SYS_ADMIN` capability is particularly dangerous:

```bash
# With CAP_SYS_ADMIN, mount a cgroup and escape
mkdir /tmp/cgrp
mount -t cgroup -o rdma cgroup /tmp/cgrp
```

### 5. Procfs Exploitation

Access to `/proc` can be leveraged for escape:

```bash
# Write to host's /proc/sys/kernel/core_pattern
echo '|/tmp/exploit.sh' > /proc/sys/kernel/core_pattern
```

## Detection

### Check for Escape Indicators

```bash
# Inside container: Check if running as root
id

# Check for privileged mode
grep Seccomp /proc/1/status
# Seccomp: 0 means no restrictions

# Check capabilities
capsh --print
# Look for dangerous caps like CAP_SYS_ADMIN
```

### Falco Rules for Detection

```yaml
- rule: Container Escape Attempt
  desc: Detect attempts to escape container
  condition: >
    container and 
    (fd.name startswith /host or
     fd.name startswith /var/run/docker.sock or
     proc.name = nsenter)
  output: Possible container escape (command=%proc.cmdline container=%container.name)
  priority: CRITICAL
```

## Prevention

### 1. Use Pod Security Standards

Apply the `restricted` profile:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: secure-apps
  labels:
    pod-security.kubernetes.io/enforce: restricted
```

### 2. Run as Non-Root

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
```

### 3. Drop All Capabilities

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
```

### 4. Use Read-Only Root Filesystem

```yaml
securityContext:
  readOnlyRootFilesystem: true
```

### 5. Apply Seccomp Profiles

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault
```

## Secure Pod Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: myapp:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```

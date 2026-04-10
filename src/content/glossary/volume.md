---
title: Volume
description: A directory accessible to containers in a Pod, used to share data or persist state beyond a container's lifetime
category: resource
relatedTerms:
  - Pod
  - PersistentVolume
  - ConfigMap
  - Secret
---

A Volume is a **directory that containers in a Pod can read and write**. It solves two problems that container filesystems alone cannot: sharing data between containers in the same Pod, and preserving data when a container restarts.

Kubernetes supports many volume types. **emptyDir** creates a temporary directory that lives as long as the Pod. **hostPath** mounts a directory from the node's filesystem into the container. **configMap** and **secret** volumes mount the contents of those objects as files. **persistentVolumeClaim** connects the Pod to a PersistentVolume for durable storage.

Volumes are defined in the Pod spec and then **mounted into each container** individually at a specified path. Multiple containers in the same Pod can mount the same volume, which is the foundation for sidecar patterns where a helper container processes data written by the main container.

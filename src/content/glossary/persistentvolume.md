---
title: PersistentVolume
description: A piece of storage in the cluster that has been provisioned for use by Pods independently of their lifecycle
category: resource
relatedTerms:
  - StatefulSet
  - Pod
  - StorageClass
---

A PersistentVolume (PV) is a piece of **storage provisioned in the cluster** that exists independently of any Pod. It can be backed by a cloud disk, NFS share, local disk, or many other storage systems. Unlike a regular volume defined inside a Pod spec, a PersistentVolume has its own lifecycle and persists even after the Pod using it is deleted.

Pods do not reference PersistentVolumes directly. Instead, a Pod requests storage through a **PersistentVolumeClaim (PVC)**, which describes the size and access mode needed. Kubernetes binds the claim to a suitable PersistentVolume. This separation keeps Pod specs portable across environments with different underlying storage.

Storage can be provisioned **statically** by an administrator who creates PVs ahead of time, or **dynamically** through a **StorageClass** that automatically provisions a volume when a PVC is created. Dynamic provisioning is the most common approach in cloud environments.

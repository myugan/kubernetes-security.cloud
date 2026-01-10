---
title: Container Escape
description: A security vulnerability where an attacker breaks out of a container to access the host system
category: attack
relatedTerms:
  - Container Breakout
mitreTechniques:
  - T1610
  - T1055
---

A container escape happens when an attacker **breaks out of the container's isolation** and gains access to the host system. Containers are supposed to be sandboxed, but misconfigurations or vulnerabilities can let someone bypass that boundary.

Common ways this happens: running containers as **privileged**, mounting sensitive host paths like `/var/run/docker.sock` or `/`, **sharing namespaces** with the host, or exploiting **kernel vulnerabilities**. Once out, an attacker can access other containers, steal secrets, or take over the node entirely.
---
title: Capturing Network Traffic with ksniff
description: Using ksniff to capture and analyze pod network traffic for security analysis
category: offensive
impact: High - Allows inspection of unencrypted traffic, credential capture, and protocol analysis
mitigation: Enable mTLS with service mesh, encrypt all internal communications, and use network policies to limit access
mitreTechniques:
  - T1040
  - T1557
tools:
  - kubectl
references: |
  - [ksniff GitHub](https://github.com/eldadru/ksniff) - kubectl plugin for packet capture
  - [Wireshark](https://www.wireshark.org/) - Network protocol analyzer
---

ksniff is a kubectl plugin that enables remote packet capture on any pod in your Kubernetes cluster. It uses tcpdump and can stream to Wireshark for real-time analysis.

## Why Network Sniffing Matters

Attackers who gain access to a pod may attempt to:

- Capture credentials from unencrypted traffic
- Observe API communication patterns
- Intercept service-to-service communications
- Identify internal services and endpoints

## Installation

Install using Krew (kubectl plugin manager):

```bash
# Install Krew first
kubectl krew install sniff
```

## Basic Usage

Capture traffic from a pod:

```bash
kubectl sniff <pod-name> -n <namespace>
```

This opens Wireshark with live traffic.

## Capturing to File

Save capture for offline analysis:

```bash
kubectl sniff <pod-name> -n <namespace> -o capture.pcap
```

## Filtering Traffic

Capture specific traffic patterns:

```bash
# Only HTTP traffic
kubectl sniff <pod-name> -f "port 80"

# Specific destination
kubectl sniff <pod-name> -f "host 10.0.0.5"

# Database traffic
kubectl sniff <pod-name> -f "port 5432"
```

## Privileged Mode

For hosts without tcpdump:

```bash
kubectl sniff <pod-name> -p
```

This uploads a static tcpdump binary.

## What Attackers Look For

### Unencrypted Credentials

```
# Captured HTTP Basic Auth
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

### Service Account Tokens

```
# JWT in Authorization header
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI...
```

### Database Connections

```
# PostgreSQL authentication
SCRAM-SHA-256 authentication
```

## Defensive Measures

### Enable mTLS

Use a service mesh for encrypted pod-to-pod communication:

```yaml
# Istio PeerAuthentication
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
```

### Network Policies

Limit which pods can communicate:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-access
spec:
  podSelector:
    matchLabels:
      app: sensitive-app
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: authorized-client
```

### Encrypt Application Traffic

- Use TLS for all internal services
- Rotate certificates regularly
- Validate certificate chains

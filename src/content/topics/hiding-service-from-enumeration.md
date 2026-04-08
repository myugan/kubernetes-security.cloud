---
title: Hiding Services from Enumeration
description: Preventing internal service discovery by disabling automatic injection of service environment variables
category: defensive
createdAt: 2026-01-14
impact: Reduces the attack surface by hiding internal service endpoints from any pods
mitigation:
  - Use DNS-based service discovery instead of environment variables
mitreTechniques:
  - T1613
references: |
  - [Accessing the Service](https://kubernetes.io/docs/tutorials/services/connect-applications-service/#accessing-the-service)
  - [Disable enableServiceLinks by default](https://docs.aws.amazon.com/eks/latest/best-practices/scale-workloads.html)
---

By default, Kubernetes injects environment variables into every pod for each service in the same namespace. This behavior was originally designed to provide backward compatibility with Docker links, a legacy feature from early container orchestration. While convenient for simple deployments, this automatic injection creates a security concern since it makes service discovery trivial for anyone with access to a pod.

When a pod starts, Kubernetes automatically creates environment variables following the pattern **{SERVICENAME}_SERVICE_HOST** and **{SERVICENAME}_SERVICE_PORT** for every service in the namespace:

```bash
env | grep _SERVICE_
```

```output
REDIS_SERVICE_HOST=10.109.0.45
REDIS_SERVICE_PORT=6379
MYSQL_SERVICE_HOST=10.109.0.82
MYSQL_SERVICE_PORT=3306
BACKEND_API_SERVICE_HOST=10.109.0.120
BACKEND_API_SERVICE_PORT=8080
```

This passive reconnaissance technique requires no network scanning and cannot be detected by network monitoring tools. An attacker immediately knows what services exist and how to reach them.

## Disabling Service Links

Set **enableServiceLinks: false** in your pod specification to prevent Kubernetes from injecting service environment variables:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  enableServiceLinks: false
  containers:
    - name: nginx
      image: nginx
```

After applying the configuration, verify that service environment variables are no longer injected:

```bash
kubectl exec -it nginx -- env | grep _SERVICE_
```

```output
KUBERNETES_SERVICE_HOST=10.96.0.1
KUBERNETES_SERVICE_PORT=443
KUBERNETES_SERVICE_PORT_HTTPS=443
```

> Only the Kubernetes API service variables remain, as these are always injected regardless of the `enableServiceLinks` setting.

With **enableServiceLinks: false**, applications should use DNS-based service discovery instead of environment variables. Kubernetes provides built-in DNS resolution for services:

```bash
# Instead of using $REDIS_SERVICE_HOST
# Use the DNS name directly
redis.default.svc.cluster.local

# Short form works within the same namespace
redis
```

The DNS naming convention follows this pattern:

| Format | Example | Scope |
|--------|---------|-------|
| `<service>` | `redis` | Same namespace |
| `<service>.<namespace>` | `redis.production` | Cross-namespace |
| `<service>.<namespace>.svc.cluster.local` | `redis.production.svc.cluster.local` | Fully qualified |

DNS-based discovery is the recommended approach for several reasons. Service names are predictable and well-documented, there's no environment variable clutter, it works across namespaces when network policies allow.

## When to Disable

Consider disabling service links when:

- Applications use DNS for service discovery, making environment variables redundant
- Namespaces contain many services, which increases pod startup time due to environment variable injection
- Following the principle of least privilege by exposing only necessary information to pods

## Limitations

Keep in mind that disabling **enableServiceLinks** is one layer of defense, not a complete solution. An attacker can still:

- **DNS resolution** remains available for service discovery since CoreDNS resolves `<service>.<namespace>.svc.cluster.local` for any valid service name
- **Network connectivity** to other pods is still allowed unless restricted by NetworkPolicy resources
- **Kubernetes API access** can list services via `kubectl get services` if the service account has the `list` verb on services resources
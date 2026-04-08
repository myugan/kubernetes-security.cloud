---
title: Detecting Shell Access in Containers with Falco
description: Alerting when interactive shells are spawned inside running containers
category: defensive
impact: Detection capability - Falco provides real-time visibility into suspicious runtime behavior, enabling rapid incident detection and response
mitigation: Deploy Falco across all nodes, configure custom rules for your environment, integrate with alerting systems, and establish incident response procedures
mitreTechniques:
  - T1059
  - T1053
  - T1611
tools:
  - falco
references: |
  - [Falco Documentation](https://falco.org/docs/) - Official Falco documentation
  - [Falco Rules](https://github.com/falcosecurity/rules) - Community-maintained Falco rules
  - [CNCF Falco Project](https://www.cncf.io/projects/falco/) - CNCF project page
---

Falco is a cloud-native runtime security tool that detects unexpected application behavior and alerts on threats at runtime. It uses system calls to monitor container and host activity.

## What is Falco?

Falco is an open-source project originally created by Sysdig and now maintained by the CNCF. It works by:

1. **Monitoring system calls** using kernel instrumentation
2. **Applying rules** to detect suspicious behavior
3. **Generating alerts** when rules are triggered

## Key Detection Capabilities

Falco can detect:

| Category | Examples |
|----------|----------|
| Container escape | Mounting sensitive paths, privilege escalation |
| Cryptomining | Unusual CPU usage, known miner binaries |
| Credential theft | Reading sensitive files, token access |
| Network attacks | Unexpected outbound connections |
| Persistence | Cron job creation, systemd modifications |

## Installation in Kubernetes

### Using Helm

```bash
# Add the Falco Helm repository
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

# Install Falco
helm install falco falcosecurity/falco \
  --namespace falco \
  --create-namespace \
  --set driver.kind=ebpf
```

### Verify Installation

```bash
kubectl get pods -n falco
kubectl logs -n falco -l app.kubernetes.io/name=falco
```

## Understanding Falco Rules

Falco rules define what behavior to detect. A rule has:

- **rule**: Name of the rule
- **desc**: Description of what it detects
- **condition**: System call conditions to match
- **output**: Alert message format
- **priority**: Severity level

### Example Rule

```yaml
- rule: Terminal shell in container
  desc: Detect shell started in a container
  condition: >
    spawned_process and 
    container and 
    shell_procs and 
    proc.tty != 0
  output: >
    Shell spawned in container 
    (user=%user.name container=%container.name 
    shell=%proc.name parent=%proc.pname)
  priority: NOTICE
  tags: [container, shell]
```

## Common Detection Rules

### 1. Detect Privileged Container

```yaml
- rule: Launch Privileged Container
  desc: Detect the launch of a privileged container
  condition: >
    container_started and container.privileged=true
  output: Privileged container started (container=%container.name image=%container.image.repository)
  priority: WARNING
```

### 2. Detect Secret Access

```yaml
- rule: Read sensitive file in container
  desc: Detect reading of sensitive files
  condition: >
    open_read and container and 
    (fd.name startswith /etc/shadow or
     fd.name startswith /var/run/secrets)
  output: Sensitive file opened (file=%fd.name container=%container.name)
  priority: WARNING
```

### 3. Detect Outbound Connection

```yaml
- rule: Unexpected outbound connection
  desc: Detect containers making unexpected network connections
  condition: >
    outbound and container and 
    not allowed_outbound_connections
  output: Unexpected outbound connection (container=%container.name dest=%fd.sip)
  priority: NOTICE
```

## Integrating with Alerting

### Slack Integration

```yaml
# falco.yaml
json_output: true
json_include_output_property: true

# Using Falcosidekick for Slack
helm install falcosidekick falcosecurity/falcosidekick \
  --set config.slack.webhookurl=https://hooks.slack.com/...
```

### Kubernetes Events

Falco can create Kubernetes events for alerts:

```yaml
helm install falco falcosecurity/falco \
  --set falcosidekick.enabled=true \
  --set falcosidekick.config.kubernetes.enabled=true
```

## Best Practices

1. **Start with default rules** - They cover common attack scenarios
2. **Tune for your environment** - Reduce false positives
3. **Create custom rules** - Detect application-specific threats
4. **Integrate with SIEM** - Centralize security monitoring
5. **Establish response procedures** - Know what to do when alerts fire

## Troubleshooting

### Check Falco Logs

```bash
kubectl logs -n falco -l app.kubernetes.io/name=falco -f
```

### Test Rules

```bash
# Trigger a test alert
kubectl exec -it test-pod -- sh -c "cat /etc/shadow"
```

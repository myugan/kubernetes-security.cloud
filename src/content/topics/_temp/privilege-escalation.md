---
title: Preventing Bind and Escalate Permissions
description: Blocking RBAC permissions that allow users to grant themselves more access
category: offensive
impact: High - Can lead to complete cluster compromise, data exfiltration, and lateral movement
mitigation: Implement RBAC with least privilege, use Pod Security Standards, regularly audit permissions, and monitor for suspicious activity
mitreTechniques:
  - T1078
  - T1543
  - T1055
tools:
  - kube-bench
  - falco
  - kubectl
references: |
  - [Kubernetes RBAC Documentation](https://kubernetes.io/docs/reference/access-authn-authz/rbac/) - Official documentation on Role-Based Access Control
  - [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/) - Kubernetes Pod Security Standards for preventing privilege escalation
---

Privilege escalation is one of the most critical attack vectors in Kubernetes security. This topic covers how attackers can gain elevated permissions and what you can do to prevent it.

## Introduction

In Kubernetes, privilege escalation can occur through various means:
- Misconfigured RBAC policies
- Overly permissive service accounts
- Container escape techniques
- Exploitation of cluster-admin bindings

## Attack Scenarios

### Scenario 1: Service Account Token Theft

Attackers who gain access to a pod can potentially steal the service account token mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`. If the service account has excessive permissions, this can lead to privilege escalation.

### Scenario 2: ClusterRoleBinding Exploitation

If a user or service account has permissions to create ClusterRoleBindings, they can bind themselves to cluster-admin, gaining full cluster access.

## Defensive Measures

1. **Implement Least Privilege**: Only grant the minimum permissions necessary
2. **Use Pod Security Standards**: Enforce security policies at the namespace level
3. **Regular Audits**: Review RBAC configurations regularly
4. **Monitor Activity**: Use audit logs to detect privilege escalation attempts

## Hands-On Practice

This is a placeholder topic to demonstrate how content is structured. In a real implementation, this would include:
- Step-by-step attack demonstrations
- Defensive configuration examples
- Lab exercises
- Code samples

---

*This is placeholder content to demonstrate the structure of topic pages.*
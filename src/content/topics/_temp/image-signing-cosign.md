---
title: Signing Container Images with Cosign
description: Using Sigstore Cosign to sign and verify container images
category: defensive
impact: High - Ensures only trusted, verified images are deployed by cryptographically signing images
mitigation: Sign all images in CI/CD pipeline, enforce signature verification in admission controller, and use keyless signing with OIDC
mitreTechniques:
  - T1525
  - T1195
tools:
  - trivy
references: |
  - [Cosign Documentation](https://docs.sigstore.dev/cosign/overview/) - Official Sigstore documentation
  - [Sigstore](https://www.sigstore.dev/) - Sigstore project homepage
---

Cosign is a tool from the Sigstore project for signing and verifying container images. It enables supply chain security by ensuring image authenticity and integrity.

## Why Sign Images

- Verify images haven't been tampered with
- Ensure images come from trusted sources
- Meet compliance requirements
- Prevent supply chain attacks

## Installation

```bash
# Install cosign
brew install cosign

# Or download binary
curl -LO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
```

## Key-Based Signing

Generate a key pair:

```bash
cosign generate-key-pair
# Creates cosign.key (private) and cosign.pub (public)
```

Sign an image:

```bash
cosign sign --key cosign.key myregistry/myimage:v1.0
```

Verify a signature:

```bash
cosign verify --key cosign.pub myregistry/myimage:v1.0
```

## Keyless Signing (Recommended)

Use OIDC identity instead of managing keys:

```bash
# Sign using GitHub Actions OIDC
cosign sign myregistry/myimage:v1.0

# Verify with identity
cosign verify \
  --certificate-identity user@example.com \
  --certificate-oidc-issuer https://accounts.google.com \
  myregistry/myimage:v1.0
```

## Signing in CI/CD

GitHub Actions example:

```yaml
- name: Sign image
  env:
    COSIGN_EXPERIMENTAL: 1
  run: |
    cosign sign ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

## Enforcing Signatures in Kubernetes

Use admission controllers to verify signatures:

### With Kyverno

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
  - name: verify-signature
    match:
      resources:
        kinds:
        - Pod
    verifyImages:
    - imageReferences:
      - "myregistry/*"
      attestors:
      - entries:
        - keyless:
            issuer: https://accounts.google.com
            subject: user@example.com
```

## Attestations

Attach additional metadata to images:

```bash
# Create SBOM attestation
cosign attest --predicate sbom.json myregistry/myimage:v1.0

# Verify attestation
cosign verify-attestation myregistry/myimage:v1.0
```

## Best Practices

1. Use keyless signing in CI/CD
2. Enforce verification in admission controller
3. Attach SBOM and vulnerability scan results
4. Sign at build time, not after push

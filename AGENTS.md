# Architecture rules

- Resolve navigation permissions from authenticated user_roles through the shared usePermissions query; database policies remain authoritative to prevent client-side bypass.
- Record payments through registrar_pagamento_seguro with an idempotency key, row locking and immutable operator-tagged history; preserve the legacy RPC as a validated compatibility wrapper.
- Keep historical payment operators unknown rather than inferring identities from ownership.
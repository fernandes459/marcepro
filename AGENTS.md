# Architecture rules

- Resolve navigation permissions from authenticated user_roles through the shared usePermissions query; database policies remain authoritative to prevent client-side bypass.
- Record payments through registrar_pagamento_seguro with an idempotency key, row locking and immutable operator-tagged history; preserve the legacy RPC as a validated compatibility wrapper.
- Keep historical payment operators unknown rather than inferring identities from ownership.
- Persist AI budget analysis and inputs in the existing budget metadata envelope, with a fixed sale price and zero-sale-price supplies grouped into real rooms; this preserves editing and avoids adding internal costs to commercial totals.
- Preserve fractional budget quantities in metadata and normalize stored integer quantities with extended costs; restore exact quantities when editing or exporting to remain compatible with the live schema.
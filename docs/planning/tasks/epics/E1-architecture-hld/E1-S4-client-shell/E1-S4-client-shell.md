# E1-S4 — Client Shell Integration (Tauri & Web)

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S4`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S1`                            |
| Status       | Proposed                           |

## Objective

Spin up the foundational React 19 UI application and wrap it inside the local
Tauri v2 desktop shell. This is scaffold only — the Hello World feature is
delivered in `E2`.

## Tasks

| Ref        | Task                              | Status   | Branch             | File |
|------------|-----------------------------------|----------|--------------------|------|
| `E1-S4-T1` | Frontend framework specification  | Proposed | `feature/E1-S4-T1` | — |
| `E1-S4-T2` | Client scaffolding & verification | Proposed | `feature/E1-S4-T2` | — |

## Measure of done

`pnpm --filter web dev` fires up the browser client and `pnpm --filter desktop tauri dev`
boots the native desktop viewport successfully (both rendering a blank shell).

## Notes

To be made Ready when `E1-S1` is Done. Can run in parallel with `E1-S2` and
`E1-S3`. Act Mode only for T2 (structural framework generation, no test gate).

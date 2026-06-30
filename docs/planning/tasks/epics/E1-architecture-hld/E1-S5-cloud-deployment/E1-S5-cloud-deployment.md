# E1-S5 — Cloud Deployment Foundations

| Field        | Value                              |
|--------------|------------------------------------|
| Reference    | `E1-S5`                            |
| Type         | story                              |
| Epic         | [`E1`](../E1-architecture-hld.md)  |
| Depends on   | `E1-S1`                            |
| Status       | Proposed                           |

## Objective

Define the declarative AWS CDK v2 infrastructure blueprints and initialize the
`packages/infra` workspace. This is scaffold only — the cloud deployment of
Hello World is delivered in `E2`.

## Tasks

| Ref        | Task                                   | Status   | Branch             | File |
|------------|----------------------------------------|----------|--------------------|------|
| `E1-S5-T1` | Infrastructure topology specification  | Proposed | `feature/E1-S5-T1` | — |
| `E1-S5-T2` | CDK application initialization         | Proposed | `feature/E1-S5-T2` | — |

## Measure of done

`pnpm --filter infra exec cdk synth` outputs a valid cloud assembly without
error, containing the ALB, VPC, and ECS Fargate cluster footprint.

## Notes

To be made Ready when `E1-S1` is Done. Can run in parallel with `E1-S2`, `E1-S3`,
and `E1-S4`. Act Mode only for T2 (infrastructure-as-code, validated via CDK
synthesis). Informed by ADR-005 from `RES-3`.

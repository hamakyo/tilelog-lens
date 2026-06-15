# Terraform

このディレクトリは TileLog Lens のCloudflare周辺リソースをTerraformで管理します。

管理対象:

- Cloudflare D1 database
- `tilelog-lens.hamakyo.dev` のproxied DNS record
- Cloudflare Access application
- 所有者メールだけを許可するCloudflare Access policy

管理しない対象:

- Worker code
- 静的assets
- Worker route
- D1 migrations

これらは引き続き Wrangler が管理します。Worker deploy と route をTerraformとWranglerの両方で管理すると、運用時の差分や上書きが発生しやすいため分離しています。

## 事前準備

Cloudflare API token を環境変数に設定します。

```bash
export CLOUDFLARE_API_TOKEN="..."
```

`terraform.tfvars` を作成します。このファイルはコミットしません。

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

必要な値:

- `cloudflare_account_id`
- `cloudflare_zone_id`
- `owner_email`

## 初期化と検証

```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform fmt -recursive
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform plan
```

## 既存リソースがある場合

既にCloudflare上にD1 database、DNS record、Access application、Access policyが存在する場合は、`terraform apply` の前にimportしてください。importせずにapplyすると重複作成を試みます。

例:

```bash
terraform -chdir=infra/terraform import cloudflare_d1_database.tilelog_lens "<account_id>/<database_id>"
terraform -chdir=infra/terraform import cloudflare_record.tilelog_lens "<zone_id>/<record_id>"
terraform -chdir=infra/terraform import cloudflare_zero_trust_access_application.tilelog_lens "<zone_id>/<application_id>"
terraform -chdir=infra/terraform import cloudflare_zero_trust_access_policy.owner "<zone_id>/<policy_id>"
```

import ID はCloudflare Terraform Providerの対象resource仕様に従ってください。

## 適用後のWorker設定

TerraformでAccess applicationを作成または更新したら、audience tagをWorker secretに設定します。

```bash
terraform -chdir=infra/terraform output -raw access_application_aud | wrangler secret put ACCESS_AUD
wrangler secret put OWNER_EMAIL
```

D1 database ID が変わった場合は、`wrangler.jsonc` の `d1_databases[0].database_id` も合わせます。

マイグレーションはWranglerで適用します。

```bash
pnpm run db:migrate:remote
```

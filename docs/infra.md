# インフラ運用

TileLog Lens の本番環境は Cloudflare Workers、Cloudflare D1、Cloudflare Access、Cloudflare DNS を使います。

## GitHub Actions

### CI

`.github/workflows/ci.yml` は `main` への push と pull request で実行します。

実行内容:

- 依存関係のインストール
- TypeScript 型チェック
- Vitest の単体テスト
- Vite ビルド

`pnpm run typecheck` はCI上で停止しないように `timeout 180s` を付けています。Playwright E2E はブラウザ依存が重く、通常CIからは分離しています。

### E2E

`.github/workflows/e2e.yml` は `workflow_dispatch` で手動実行します。

実行内容:

- Chromium のインストール
- `pnpm run test:e2e`
- `playwright-report/` と `test-results/` のartifact保存

本番データやスクリーンショット画像は使わず、テスト用のローカルWorkerとテストデータだけで実行します。

### Deploy

`.github/workflows/deploy.yml` は `workflow_dispatch` で手動実行します。

本番deploy jobは `main` ブランチでだけ実行されます。deploy前に TypeScript 型チェック、Vitest、Vite ビルドを再実行します。

必要な GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`: Workers deploy とD1 migrationに必要なCloudflare API token

Worker runtime secrets は GitHub に置かず、Cloudflare 側に設定します。

- `OWNER_EMAIL`
- `ACCESS_AUD`
- `ACCESS_ISSUER`
- `ACCESS_JWKS_URL`

リモートD1マイグレーションをデプロイ前に適用する場合は、手動実行時に `apply_migrations` を有効にします。

### Terraform Plan

`.github/workflows/terraform-plan.yml` は `workflow_dispatch` で手動実行します。

必要な GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`
- `TF_OWNER_EMAIL`: TerraformでCloudflare Access policyに設定する所有者メール
- `TF_IMPORT_D1_DATABASE_ID`: 既存D1 database ID
- `TF_IMPORT_DNS_RECORD_ID`: 既存DNS record ID
- `TF_IMPORT_ACCESS_APPLICATION_ID`: 既存Cloudflare Access application ID
- `TF_IMPORT_ACCESS_POLICY_ID`: 既存Cloudflare Access policy ID

必要な GitHub Variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`

このworkflowは既存Cloudflareリソースを一時stateへimportしてから `terraform plan` まで実行します。import用secretが未設定の場合は、空stateによる誤解しやすいplanを避けるため失敗します。`terraform apply` はローカルで内容を確認してから実行します。

## Terraform と Wrangler の責務

Terraform は次のCloudflareリソースを管理します。

- D1 database
- 本番ホスト名のDNS record
- Cloudflare Access application
- 所有者メールだけを許可するCloudflare Access policy

Worker本体、静的assets、Worker route、D1 migrations は引き続き Wrangler が管理します。Worker deploy と route 管理をTerraformとWranglerで二重管理すると差分の原因になるため、このプロジェクトでは分離します。

Terraform output の `access_application_aud` は Worker secret `ACCESS_AUD` として設定します。

```bash
terraform -chdir=infra/terraform output -raw access_application_aud | wrangler secret put ACCESS_AUD
wrangler secret put OWNER_EMAIL
wrangler secret put ACCESS_ISSUER
wrangler secret put ACCESS_JWKS_URL
```

Terraform の具体的な実行手順は [infra/terraform/README.md](/Users/kyoshirohama/Documents/tilelog-lens/infra/terraform/README.md) を参照してください。

## セキュリティ方針

- Cloudflare API token、Terraform state、`terraform.tfvars` はコミットしません。
- スクリーンショット画像やbase64ペイロードはサーバーに送信・保存・ログ出力しません。
- CSV/JSONエクスポートは認証済みユーザーの手動操作だけで実行します。
- AI用JSONは既定でプレイヤー識別子を匿名化します。

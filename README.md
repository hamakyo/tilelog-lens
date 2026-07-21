# TileLog Lens

TileLog Lens は、雀魂 / Mahjong Soul の対局後スクリーンショットから確認した数値を記録する、非公式・個人利用向けの戦績トラッカーです。

累積戦績のスナップショットを保存し、傾向分析、期間差分、CSV/JSONエクスポートを行えます。用途は **対局後の個人記録** に限定しています。

## このアプリでできること

- 自分の対局後・プロフィール戦績スクリーンショットから確認した数値を記録します。
- すべての記録で観測日と `HH:mm` 形式の時刻を必須にします。
- ローカルスクリーンショットに対して、ブラウザ内だけで任意のOCRを実行し、読み取り位置を調整できます。
- OCR結果は項目ごとに信頼度を表示し、読み取り位置プリセットを保存できます。
- 東風戦、半荘戦、三人戦、その他のゲームモードに対応します。
- 確認済みの数値データを Cloudflare D1 に保存します。
- トレンドチャート、推定期間差分、直近期の成績差分を表示します。
- 直近10件と月単位の期間比較を表示します。
- 週次・月次レポートで、期間ごとの成績、改善点、次に見る項目を確認できます。
- 最新値と直近期から分析コメントを自動生成します。
- 改善優先度スコアを表示します。
- ゲームモード別にダッシュボードを切り替えられます。
- 設定ページで、ダッシュボードカードの表示有無と順序を変更できます。
- 任意の2つのスナップショットを比較できます。
- 保存前に、OCR結果、前回同モードとの差分、重複候補を確認するフローを表示します。
- 保存前に、前回記録との不自然な差分、重複候補、段位ポイント上限超過を警告します。
- データ品質レポートで、修正候補の記録を一覧化します。
- データ品質レポートで、警告種別ごとに修正候補を絞り込めます。
- データ品質レポートから該当記録の編集画面へ移動できます。
- 詳細分析を概要、立直、改善、詳細に分け、対象データ内の指標分布、平均との差、安定性を確認できます。
- 詳細分析は単一ゲームモードに統一し、期間プリセットと詳細条件で対象を絞り込めます。
- 分析結果の結論、根拠、関連記録への導線を最上部に表示します。
- モード、条件、タブ、チャート指標を分析ビューとしてD1に保存し、端末間で同期できます。
- 改善施策の開始値、目標値、評価対戦数、現在の進捗をD1に保存して追跡できます。
- 記録更新時の変更履歴を保存します。
- インポート履歴に、保存結果、画像ハッシュ、ファイル名、OCR項目数を記録します。
- 表計算向けCSVをエクスポートします。
- 外部AI分析に渡しやすいJSONをエクスポートします。
- CSV/JSONはダウンロード前に画面上でプレビューできます。
- AI用JSONから数値スナップショットを復元インポートできます。
- Cloudflare Access のメールOTPで所有者だけがログインできます。
- 認証済みの状態ページで、WorkerとD1の最小ヘルスチェックを確認できます。
- 設定ページで所有者情報や基本設定を確認できます。

## このアプリでしないこと

- スクリーンショット画像をサーバー側に保存しません。
- ゲームクライアントを改変しません。
- 通信内容を解析しません。
- 対局を自動化しません。
- 対局中のリアルタイム助言を提供しません。
- アプリUIに公式ロゴ、キャラクター、著作物アセットを使用しません。
- Yostar または Mahjong Soul / 雀魂 との公式な関係を示しません。

## 分析機能

詳細分析では、保存済みの数値・メモ・メタデータだけを対象に、次の機能を利用できます。スクリーンショット画像やbase64データは分析・保存しません。

- 単一ゲームモードと任意期間・成績条件による分析スコープ
- 直近30日・90日・全期間の期間プリセット
- 結論、改善優先度、悪化要因、確認項目と根拠記録への導線
- 概要、立直、改善、詳細のカテゴリ別分析
- 分析目標、カスタム指標、目的別テンプレート、変化点検出
- 自由選択チャート、タグ別集計、期間比較、推定期間差分
- 条件・タブ・チャート指標を再利用する保存済み分析ビュー
- 開始値・目標値・評価対戦数を追跡する改善施策トラッカー
- 累積値による長期スタイルと、直近期間による現在状態の分離評価
- 実測戦数、窓誤差、標本強度を反映した推定結果の信頼度表示

期間分析は目標戦数に最も近い基準記録を選び、窓誤差25%を超える場合や実測10戦未満の場合は判定しません。累積率の丸め差分から算出する値は推定値として表示します。ゲームモード別の判定基準は `provisional`（暫定）であり、外部根拠に応じて更新します。

分析ビューと改善施策はD1を正本、ブラウザのlocalStorageを表示キャッシュとして扱います。端末ごとの初回同期だけID単位で統合し、`updated_at`が新しい側、同時刻ならD1側を採用します。移行完了後はD1からキャッシュを更新します。

## 免責事項

本アプリは、雀魂 / Mahjong Soul の非公式・個人用戦績記録ツールです。

対局後の個人記録だけを目的としており、ゲームクライアントの改変、通信解析、自動操作、リアルタイム支援は行いません。

スクリーンショット画像はブラウザ内でのみ処理し、サーバーには保存しません。保存されるのは、ユーザーが確認した戦績数値と任意の画像メタデータだけです。

## 技術スタック

- React SPA
- Vite
- TypeScript
- Hono
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Access email One-time PIN / OTP
- Zod
- jose
- Vitest

## システム構成

![TileLog Lens システム構成](docs/architecture.svg)

スクリーンショットはブラウザ内だけで処理します。APIリクエストには、確認済みの戦績数値と、必要に応じてハッシュ・画像サイズ・ファイル名などのメタデータだけを含めます。スクリーンショット画像やbase64ペイロードは送信しません。

## リポジトリ構成

```txt
.
├─ .github/workflows/       # CI、E2E、deploy、Terraform plan
├─ docs/                    # アーキテクチャ図と運用ドキュメント
├─ infra/terraform/         # D1、DNS、Cloudflare Access のIaC
├─ migrations/
│  └─ *.sql                 # Cloudflare D1 migration
├─ src/
│  ├─ worker/               # Hono API、Access認証、D1アクセス
│  ├─ web/                  # React SPA、OCR、画面コンポーネント
│  └─ shared/               # Zod schema、型、分析ロジック
├─ tests/                   # Vitest と Playwright E2E
├─ README.md
├─ AGENTS.md
├─ DESIGN.md
├─ PLAN.md
└─ SPEC.md
```

## 環境変数とバインディング

Worker が想定する環境は次の通りです。

```ts
interface Env {
  DB: D1Database;
  ENVIRONMENT: "development" | "preview" | "production";
  OWNER_EMAIL: string;
  ACCESS_AUD: string;
  ACCESS_ISSUER: string;
  ACCESS_JWKS_URL: string;
}
```

`wrangler.jsonc` の例です。

```jsonc
{
  "name": "tilelog-lens",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-06-01",
  "workers_dev": false,
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tilelog_lens",
      "database_id": "<database-id>"
    }
  ],
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

Cloudflare Access 関連値は公開リポジトリにteam domainを出さないため、Worker secretsとして設定します。

```bash
wrangler secret put OWNER_EMAIL
wrangler secret put ACCESS_AUD
wrangler secret put ACCESS_ISSUER
wrangler secret put ACCESS_JWKS_URL
```

## 設定情報の扱い

`wrangler.jsonc` には、D1 database ID、本番ホスト名など、デプロイ固有の識別子が含まれる場合があります。

これらは単体ではアプリケーション秘密情報ではありませんが、デプロイ構成のメタデータです。公開リポジトリにする場合は、コミットしたままにするかプレースホルダーへ置き換えるかを確認してください。

次の値はコミットしないでください。

- `OWNER_EMAIL`
- `ACCESS_AUD`
- `ACCESS_ISSUER`
- `ACCESS_JWKS_URL`
- APIトークン
- Cloudflareアカウントトークン
- 秘密鍵や認証情報

## Cloudflare Access 設定概要

1. Cloudflare Zero Trust を開きます。
2. 本番ホスト名用の self-hosted Access application を作成します。
3. One-time PIN / OTP ログインを有効にします。
4. Allow policy を作成します。
5. 所有者のメールアドレスだけを許可対象にします。
6. `Everyone`、広すぎるドメイン、bypass policy は追加しません。
7. Application audience tag を確認し、`ACCESS_AUD` として設定します。
8. JWT検証用に `ACCESS_ISSUER` と `ACCESS_JWKS_URL` を設定します。
9. 本番では `workers_dev` を無効にするか、workers.dev も Access で保護します。

`ACCESS_ISSUER` は `https://<team-name>.cloudflareaccess.com`、`ACCESS_JWKS_URL` は `<ACCESS_ISSUER>/cdn-cgi/access/certs` の形式です。`<team-name>` はCloudflare Zero Trustのteam domainです。

現在想定している本番ホスト名は次の通りです。

```txt
tilelog-lens.hamakyo.dev
```

Worker route はこのホスト名向けに設定されています。ホスト名でアクセスするには、Cloudflare DNS で `tilelog-lens.hamakyo.dev` の proxied DNS record を作成してください。

Cloudflare Access が設定され、`ACCESS_AUD`、`ACCESS_ISSUER`、`ACCESS_JWKS_URL` が正しく設定されるまでは、有効な Access JWT がないリクエストを Worker が拒否します。

## ローカル開発

基本コマンドです。

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

ローカルD1を使う場合:

```bash
wrangler d1 create tilelog_lens
pnpm run db:migrate:local
pnpm run dev
```

リモートD1にマイグレーションを適用する場合:

```bash
wrangler d1 migrations apply tilelog_lens --remote
```

## CI/CD とIaC

GitHub Actions、Cloudflareデプロイ、Terraformによる周辺インフラ管理は [docs/infra.md](/Users/kyoshirohama/Documents/tilelog-lens/docs/infra.md) を参照してください。

Terraform設定は [infra/terraform/README.md](/Users/kyoshirohama/Documents/tilelog-lens/infra/terraform/README.md) にあります。Worker本体と静的assetsはWrangler、D1・DNS・Cloudflare AccessはTerraformで管理します。

## D1バックアップと復元

リモートマイグレーションやリスクのあるデータ変更の前に、リモートD1のSQLバックアップを作成します。

```bash
pnpm run db:backup:remote
```

このコマンドは `backups/tilelog_lens-remote-latest.sql` を出力します。`backups/*.sql` は、個人戦績、メモ、プレイヤー識別子、ソースメタデータを含む可能性があるため、意図的にgitignoreしています。

タイムスタンプ付きバックアップを作成する場合:

```bash
mkdir -p backups
wrangler d1 export tilelog_lens --remote --skip-confirmation --output "backups/tilelog_lens-remote-$(date -u +%Y%m%dT%H%M%SZ).sql"
```

復元はまずローカルD1で試し、アプリの表示を確認してからリモートに適用してください。

```bash
wrangler d1 execute tilelog_lens --local --file backups/tilelog_lens-remote-latest.sql
pnpm run dev
```

リモート復元は意図的に手動操作にしています。

```bash
wrangler d1 execute tilelog_lens --remote --file backups/tilelog_lens-remote-latest.sql
```

リモート復元は、対象データベースとバックアップファイルを確認してから実行してください。バックアップファイルはコミットしないでください。

## デプロイ

```bash
pnpm run deploy
```

## 継続的インテグレーション

GitHub Actions は `main` へのpushとpull requestで主要な検証を実行します。

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm run test:e2e:smoke
```

pull requestではDesktop ChromeのスモークE2Eを実行し、インポート、保存前確認、ダッシュボード、AI JSON出力、記録編集、分析フィルタを検証します。失敗時はPlaywright report、trace、スクリーンショットをartifactへ保存します。全ブラウザ・モバイルを含むE2Eは `pnpm run test:e2e` で手動実行します。

`/ai-plan` コメントをIssueに投稿すると、`AI Pipeline Commands` workflow が `PLAN.md` のIssue別セクションを作成し、draft planning PRを開きます。

`/ai-implement` コメントも検知しますが、GitHub Actions上にはHermes runnerを設定していないため、実装はローカルのCodex/Hermes環境で `github-ai-pipeline` skill に従って進めます。存在しない自動実装daemonとして扱わないため、workflowはGitHub上に停止理由をコメントします。

## 基本利用フロー

1. Cloudflare Access のメールOTPでログインします。
2. インポートページを開きます。
3. 観測日と必須の `HH:mm` 時刻を入力します。
4. 必要に応じてローカルスクリーンショットを選択し、ブラウザ内プレビュー/OCRを使います。
5. OCRの読み取り位置がずれる場合は、横位置・縦位置・領域サイズを調整します。
6. OCR結果を確認し、必要な項目を手動で修正します。
7. 保存前の警告を確認し、スナップショットをD1に保存します。
8. ダッシュボードでモード別の傾向を確認します。
9. 比較ページで任意の2記録の差分を確認します。
10. CSVまたは匿名化済みAI JSONをダウンロードします。
11. 設定ページで所有者情報やエクスポート設定を確認します。

## データモデル概要

主テーブルは `stat_snapshots` です。分析設定には `analysis_saved_views` と `analysis_experiments` を使用します。

保存する主なデータ:

- 観測日時
- ゲームモード
- 段位情報
- 対戦数
- 順位率
- 和了率、放銃率、副露率、立直率
- 任意メモ
- 任意のソース画像ハッシュ
- 任意のソースメタデータ

改善施策が参照するスナップショットを削除した場合、`baseline_snapshot_id`だけを`null`にし、保存済みの開始値、対戦数、観測日時は維持します。スナップショットとインポート履歴、更新内容と変更履歴は、それぞれ同じD1 batchで原子的に保存します。

保存しないデータ:

- 画像バイト列
- base64スクリーンショット
- スクリーンショットURL
- 公式アセット

## エクスポート動作

CSV/JSONファイルは、D1からオンデマンドで生成し、ダウンロードレスポンスとして返します。サーバー側には保存しません。

デフォルトのAI JSONエクスポートはプレイヤー識別子を匿名化し、次の内容を含みます。

- 指標説明
- 最新状態、主な悪化要因、優先アクションの要約
- スナップショット
- 派生指標
- 推定差分
- 直近期の期間分析
- 期間比較
- 指標分布と安定性スコア
- 立直トレンドと立直リスクシグナル
- 長期・直近の攻撃タイプ分類と改善・安定・悪化状態
- 分析エンジン版、暫定プロファイル、推定方法、実測戦数、窓誤差、信頼度
- 改善優先度
- 悪化要因ランキング
- 見るべき項目
- 既定目標との差分コメント
- 段位ポイント分析
- データ品質警告
- 分析リクエスト
- スクリーンショットが含まれないことを示すプライバシーメタデータ

## プライバシー注意事項

- アプリは Cloudflare Access の背後で非公開にしてください。
- エクスポートする意図がない限り、メモ欄に機微な個人情報を入れないでください。
- JSON/CSVを第三者AIツールへアップロードする前に内容を確認してください。
- 既定では匿名化エクスポートを使用してください。

## セキュリティ注意事項

- Workerで Access JWT を検証します。
- `OWNER_EMAIL` だけを許可します。
- APIリクエスト内の画像/base64ペイロードを拒否します。
- OCRテキストとスクリーンショットはブラウザ内に留め、APIへ送信しません。
- リクエストボディ制限は小さく保ちます。
- JWT、メモ、プレイヤーID、エクスポートペイロードをログに出力しません。
- Workerのエラーログは、イベント、メソッド、パス、エラー種別/メッセージ、snapshot id などの非機微な識別子に限定します。
- 本番では、別途保護しない限り `workers_dev` を無効にします。

## 既知の制限

- OCRは固定クロップ領域を使うため、手動修正が必要な場合があります。
- クロップ領域のキャリブレーションUIは未実装です。
- 過去データ一括投入用のCSVインポートは未実装です。
- PWA / オフラインモードは未実装です。
- ゲームモード別の分析しきい値は、外部根拠が整うまで暫定値です。

## 公式ドキュメント参照

- Cloudflare Access One-time PIN: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare D1 with Hono: https://developers.cloudflare.com/d1/examples/d1-and-hono/
- Hono on Cloudflare Workers: https://hono.dev/docs/getting-started/cloudflare-workers

## ライセンス

公開前にライセンスを選択してください。個人利用の非公開リポジトリであれば、公開ライセンスは必須ではありません。リポジトリを公開する場合はMITが無難ですが、Mahjong Soul / 雀魂のアセットは含めないでください。

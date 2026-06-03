import { PRIVACY_DISCLAIMER } from "../../shared/constants";

export function SettingsPage() {
  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">設定</p>
          <h1>プライバシーとデプロイ</h1>
        </div>
      </div>

      <section className="settings-panel">
        <h2>アクセス制御</h2>
        <p>
          本番環境は、所有者メールのみを許可するCloudflare AccessのメールOTPで保護します。Worker側でもAccess JWTを検証します。
        </p>
      </section>

      <section className="settings-panel">
        <h2>スクリーンショットの扱い</h2>
        <p>
          ローカル画像の選択は、ブラウザ内のプレビュー、SHA-256、画像サイズ取得にだけ使います。APIは画像、ファイル、base64、blob、data URLを含むpayloadを拒否します。
        </p>
      </section>

      <section className="settings-panel">
        <h2>免責事項</h2>
        <p>{PRIVACY_DISCLAIMER}</p>
      </section>
    </main>
  );
}

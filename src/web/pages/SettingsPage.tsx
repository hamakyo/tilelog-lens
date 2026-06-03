import { PRIVACY_DISCLAIMER } from "../../shared/constants";

export function SettingsPage() {
  return (
    <main className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Privacy And Deployment</h1>
        </div>
      </div>

      <section className="settings-panel">
        <h2>Access</h2>
        <p>
          Production should be protected by Cloudflare Access email OTP with a policy
          that includes only the owner email. The Worker also validates the Access JWT.
        </p>
      </section>

      <section className="settings-panel">
        <h2>Screenshot Policy</h2>
        <p>
          Local image selection is only used for browser-side preview, SHA-256, and
          dimensions. The API rejects image, file, base64, blob, and data URL payloads.
        </p>
      </section>

      <section className="settings-panel">
        <h2>Disclaimer</h2>
        <p>{PRIVACY_DISCLAIMER}</p>
      </section>
    </main>
  );
}

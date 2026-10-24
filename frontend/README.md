# Frontend

React / TypeScript / ViteによるGold Investment Appの画面です。
起動・環境変数・DB・テスト・公開準備の手順は[ルートREADME](../README.md)を参照してください。

```powershell
npm.cmd ci
npm.cmd run dev
```

API接続先は`frontend/.env`の`VITE_API_BASE_URL`で指定します。
空欄時は開発時に`http://127.0.0.1:8000`、本番ビルドでは同じドメインの`/api`を使用します。設定変更後は開発サーバーを再起動、本番は再ビルドしてください。

Vercelではリポジトリ直下をRoot Directoryにして、画面とFastAPIを一緒にデプロイします。この構成ではAPI接続先を常に`/api`に固定するため、`VITE_API_BASE_URL`の設定は不要です。必要な環境変数と設定は[ルートREADME](../README.md#vercelへデプロイ)を参照してください。

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

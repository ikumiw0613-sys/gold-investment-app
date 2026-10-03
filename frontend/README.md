# Frontend

React / TypeScript / ViteによるGold Investment Appの画面です。
起動・環境変数・DB・テスト・公開準備の手順は[ルートREADME](../README.md)を参照してください。

```powershell
npm.cmd ci
npm.cmd run dev
```

API接続先は`frontend/.env`の`VITE_API_BASE_URL`で指定します。
空欄時は`http://127.0.0.1:8000`です。設定変更後は開発サーバーを再起動、本番は再ビルドしてください。

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

# Gold Investment App — v1

ポイント投資の記録と、GLD・ドル円を使った概算の運用状況を確認する個人向けアプリです。

**評価額・損益・平均取得価格などはGLDとUSD/JPYを利用した概算値です。PayPayポイント運用の実際の評価額と一致しない可能性があります。** PayPayとの連携や実際の売買は行いません。

## 主な機能・使用技術

- 推定評価額、投入ポイント、手数料、評価損益・損益率、平均取得価格と現在価格の比較。
- ポイント追加、PostgreSQLへの保存、投資履歴画面（PCは表・スマホはカード）。
- GLDチャート：7日／1か月／3か月／1年。DB履歴とTwelve Data履歴を統合し、同日はDB価格を優先。
- 投資マーカー：投資日・追加ポイント・投資時GLD価格。同日の複数記録を保持。
- 市場価格の日次保存、外部APIの1時間キャッシュ。

React 19 / TypeScript / Vite / Recharts、Python / FastAPI / SQLModel / SQLAlchemy / APScheduler 3、PostgreSQLを使用します。
価格データはTwelve DataとGoldAPIから取得します。

## Vercelへデプロイ

画面とFastAPIを**1つのVercelプロジェクト**で公開できます。`app.py`が画面を`/`、APIを`/api`以下に配置し、`vercel.json`が画面のビルドと日次保存を設定します。
FastAPIの静的ファイル配信・lifespan・Cronは[Vercel公式の対応機能](https://vercel.com/docs/frameworks/backend/fastapi)を使用しています。

Vercel用のルート`requirements.txt`は依存パッケージを直接列挙しています。依存関係を変更するときは`backend/requirements.txt`と両方を更新してください。

1. このリポジトリをGitへ反映し、Vercelの **Add New → Project** からインポートします。
2. **Root Directoryはリポジトリ直下（`.`）**、Framework Presetは **FastAPI** にします。`frontend`や`backend`をRoot Directoryにしないでください。
3. Node.jsはルート`package.json`で **24.x**、Pythonは`.python-version`で3.13を指定しています。Build Commandは`vercel.json`の値を使用し、Install CommandとOutput Directoryは上書きしません。
4. 以下の環境変数をVercelの **Settings → Environment Variables** に登録して、デプロイします。

| 環境変数 | 値 |
| --- | --- |
| `DATABASE_URL` | Vercelから接続できるPostgreSQLの接続文字列。例：`postgresql+psycopg2://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require`。サーバーレス向けの接続プールURLを利用できます。ローカルPCのDBには接続できません。 |
| `TWELVE_DATA_API_KEY` | Twelve DataのAPIキー |
| `GOLD_API_KEY` | GoldAPIのAPIキー |
| `CRON_SECRET` | 16文字以上のランダムな秘密文字列。Cronリクエストの認証に使用します。 |

`VITE_API_BASE_URL`は**設定不要**です。Vercelでのビルドは常に同じドメインの`/api`へ接続し、古いローカル用URLが環境変数に残っていても使用しません。Vercel以外では従来どおりこの変数で接続先を変更できます。秘密情報を`VITE_`変数へ登録しないでください。

DBユーザーには初回のDBアクセス時のテーブル作成権限が必要です。既存のDBを指定した場合はその投資履歴を利用します。Previewで登録したデータも同じDBへ保存されるため、PreviewとProductionには別々のDBを設定してください。

**公開用DBをまだ作成していない場合**は、クラウド上にPostgreSQLのDB・接続ユーザーを作成し、提供される接続URLをVercelの`DATABASE_URL`へ設定してください。コードの変更だけで公開用DBは作成されません。Vercelではローカルの`.env`を読み込まず、`localhost`・SQLiteのDB接続先を拒否します。PostgreSQL接続URLの`postgres://`と`postgresql://`はインストール済みドライバー向けに変換し、TLSを有効化します。接続タイムアウトは未指定時10秒です。

公開用の設定例は[deploy/vercel.env.example](deploy/vercel.env.example)です。値を埋めたローカルファイルで、接続URLの形式と必須設定を確認できます（秘密情報の表示や外部通信はしません）。

```powershell
if (-not (Test-Path .env.production)) { Copy-Item deploy/vercel.env.example .env.production }
# .env.productionの値を編集した後に実行します。このファイルはGit管理対象外です。
.\.venv\Scripts\python.exe -B scripts/check_deployment.py --env-file .env.production
```

チェックが成功したら、その値をVercelのEnvironment Variablesにも設定して再デプロイします。このチェックは実際のDB接続・APIキーの有効性までは検証しません。

デプロイ後は`/`と`/#/history`の表示、`/api/health`の`{"status":"ok"}`応答、ポイント追加後の再読み込みで履歴が残ることを確認します。APIドキュメントは`/api/docs`です。DB未設定でも画面のHTMLと`/api/`は配信しますが、履歴の取得・登録とDB接続確認は503を返します。DBを設定するまでは投資記録を保存できません。APIキー未設定時も外部APIを呼び出さず、市場データの取得は503を返します。

現在のアプリにはログイン・ユーザー別のデータ分離がなく、アクセスできる人全員が同じ履歴を閲覧・登録できます。個人の投資履歴を置く場合は画面と`/api/*`の両方に認証・アクセス制限を適用してください。

### Vercelでの日次保存

Vercelでは常駐スケジューラーを自動的に無効化し、Vercel Cronが`GET /api/cron/market-prices`を呼び出します。`CRON_SECRET`が一致しないリクエストは拒否します。保存処理は既存の「同日1行」の処理を利用します。

スケジュールの`10 22 * * *`はUTC 22:10、**日本時間の翌朝7:10**です。Hobbyプランでは指定した時間帯の中で実行時刻がずれる場合があります。CronはProductionデプロイだけで実行されます。時刻の変更は`vercel.json`の`crons`を編集して再デプロイします（`MARKET_SAVE_HOUR` / `MARKET_SAVE_MINUTE`はローカルの常駐スケジューラー用です）。詳細は[Vercel Cronの公式説明](https://vercel.com/docs/cron-jobs/manage-cron-jobs)を参照してください。

Vercel上のAPIキャッシュはインスタンスごとで、起動し直すと消えます。外部APIの呼び出し回数はアクセス数や起動するインスタンス数によって増えます。Cron失敗時の同日自動再試行はありません。手動保存には既存の`POST /api/market-prices`を利用できます。

### ビルド済みの公開構成をローカルで確認

```powershell
# リポジトリ直下で実行。DB・APIキーはローカル起動と同じ設定です。
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

`http://127.0.0.1:8000/`から画面と`/api`を一緒に確認できます。Vercelへの実デプロイにはVercelアカウントと上記の環境変数が必要です。

## ローカル起動

Node.js 24、Python 3.13、PostgreSQLを用意してください。以下はリポジトリ直下から開始するPowerShellの例です。

### 1. 環境変数・DB

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
```

既に`.env`がある場合は上書きせず、不足する設定だけ追加してください。
PostgreSQLでこのアプリ用のDBと接続ユーザーを用意し、ルートの`.env`にAPIキーと接続文字列を設定します。

| キー | 設定場所・用途 | 空欄時の動作 |
| --- | --- | --- |
| `TWELVE_DATA_API_KEY` | ルート`.env`。GLD・USD/JPY・履歴の取得 | 市場取得には有効なキーが必要 |
| `GOLD_API_KEY` | ルート`.env`。金スポット価格の取得 | 市場取得には有効なキーが必要 |
| `DATABASE_URL` | ルート`.env`。PostgreSQL接続文字列 | 起動エラー |
| `CORS_ORIGINS` | ルート`.env`。許可する画面のoriginをカンマ区切り | `http://localhost:5173,http://127.0.0.1:5173` |
| `SCHEDULER_ENABLED` | ルート`.env`。`true` / `false` | `true` |
| `MARKET_SAVE_HOUR` | ルート`.env`。日本時間の保存時刻、0〜23 | `7` |
| `MARKET_SAVE_MINUTE` | ルート`.env`。保存時刻の分、0〜59 | `10` |
| `VITE_API_BASE_URL` | **`frontend/.env`**。APIのベースURL | 開発時は`http://127.0.0.1:8000`、本番ビルドは`/api` |
| `CRON_SECRET` | Vercelの環境変数。日次保存の認証 | Cron用エンドポイントは503を返す |

接続文字列の形式は `postgresql+psycopg2://USER:PASSWORD@HOST:5432/DB_NAME` です。
パスワードの特殊文字はURLエンコードしてください。実際の認証情報はGitへ追加しません。
ルート`.env.example`は全キーの一覧です。Vite用の値は`frontend/.env`へ設定してください。
ローカルのバックエンドはプロセス環境変数 → ルート`.env` → 既存の`backend/.env`の優先順位で読み込みます。Vercelではプロセス環境変数だけを使用します。
`VITE_`変数はブラウザへ公開されるため、APIキーやDB接続文字列を入れないでください。

### 2. バックエンド

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API: `http://127.0.0.1:8000`、APIドキュメント: `http://127.0.0.1:8000/docs`。
`/`は生存確認用です。開発用の`/db-check`は削除しました。
仮想環境をactivateしなくても上記コマンドで起動できます。

### 3. フロントエンド（別ターミナル）

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

通常の画面URLは`http://localhost:5173`です。`#/`がダッシュボード、`#/history`が投資履歴です。
Viteが別ポートで起動した場合はそのoriginも`CORS_ORIGINS`に設定するか、5173番を空けてください。
macOS/Linuxでは`npm.cmd`を`npm`、Python実行パスを`.venv/bin/python`に読み替えます。

## DBと日次保存

- 初回DBアクセス時に`investment_records`と`market_prices`の未作成テーブルを作成します。ローカルでは起動時にDBへアクセスします。
- `create_all`は既存テーブルの列・制約を変更しません。スキーマ変更時は別途マイグレーションが必要です。
- `market_prices.date`は一意。同日の再保存は既存行を返し、同時保存も一意制約違反を処理します。既存DBにも一意制約があるか確認してください。
- 保存日とスケジュールは`Asia/Tokyo`。既定は**毎日7:10**で、当日の実行時点の取得値を保存します。提供元の取引日と保存日は異なる場合があります。
- FastAPIのlifespanでスケジューラを開始・終了し、再起動時にジョブを再登録します。
- PostgreSQLのセッションadvisory lockで同じDB上のスケジューラ所有者を1つに制限します。専用接続を1本使うため、直接接続またはセッションプールが必要です。トランザクションプールには対応しません。
- **v1は1ワーカー・1インスタンスで運用してください。** 所有者の異常終了・接続断後に別ワーカーが自動で引き継ぐ仕組みはありません。復旧時はアプリを再起動します。
- 停止中の日時は自動補完しません。起動中の遅延実行は1時間まで許容します。外部API失敗時の同日自動再試行はありません。
- `POST /market-prices`で当日分を手動保存、`GET /market-prices`で保存済みデータを取得できます。

pgAdminでは以下の読み取りクエリで日次保存を確認できます。

```sql
SELECT date, gld_price, usd_jpy, xau_usd_price
FROM market_prices ORDER BY date DESC;

SELECT date, COUNT(*) FROM market_prices
GROUP BY date HAVING COUNT(*) > 1;
```

投資履歴APIは`POST /investments`と`GET /investments`です。
履歴画面は開くたびにDBから取得し、再読み込み後も保存済みの履歴を表示します。

## APIキャッシュと概算値

市場データはプロセス内に1時間キャッシュします。GLDは最大366件の時系列を取得し、最新価格と各チャート期間で共有します。
通常の初回ダッシュボード表示はTwelve Data 2回（GLD・USD/JPY）、GoldAPI 1回の取得です。
期限後は次のアクセス時に更新します。日次保存も同じキャッシュを使うため、最大1時間前の値を保存する場合があります。
外部APIエラー時は提供元ごとに1時間取得を休止し、503を返します。数値の`Retry-After`が長い場合はその時間を優先します。
キャッシュは再起動で消え、ワーカー間では共有されません。フロントエンドは通信中の同一GETのみを共有します。

平均取得価格は `累計 investedPoints / 累計 virtualAmount` です。
仮想保有量はGLD×USD/JPYを基準にするため、平均は`pt/口`で表示し、現在価格も同じ単位に換算して比較します。
乖離率には為替の変動を含みます。利益計算は追加ポイントを基準とするため、手数料分だけ乖離率と損益率が異なることがあります。

## テストとビルド

```powershell
# frontend ディレクトリ
npm.cmd test
npm.cmd run lint
npm.cmd run build

# backend ディレクトリ
..\.venv\Scripts\python.exe -B -m unittest discover -v
```

フロントエンドは計算・期間絞り込み・統合・マーカー・履歴表示・API通信をテストします。
バックエンドは外部APIをモックし、一時SQLiteで登録・永続化・再起動・日次保存・CORSをテストします。
PostgreSQLのスケジューラ所有権テストはDB接続をモックしています。実際のPostgreSQLや外部APIの動作を保証するテストではありません。
テストは開発用DBへ接続せず、API利用枠も消費しません。

ビルド結果は`frontend/dist`です。`npm.cmd run preview`はビルド確認用（通常4173番）で、本番サーバーではありません。
プレビューに接続する場合は4173番のoriginをCORSに設定してください。

### v1仕上げ時の確認結果（2026-10-03）

- frontend 37テスト、backend 19テスト、frontend build / lintが成功。
- 設定済みの実PostgreSQLへ接続し、隔離した検証用スキーマ内で登録・取得・API再起動後の読み取り・同日の市場価格保存を確認。検証用スキーマはトランザクションのロールバックで除去し、既存データは変更していません。
- 実PostgreSQLでスケジューラのロック取得・多重起動抑止・終了後の再取得を確認。
- 実際の外部APIからGLD・USD/JPY・金スポット価格の取得を確認。
- 別の`VITE_API_BASE_URL`でビルドし、設定値の反映を確認。
- ブラウザ接続を利用できなかったため、ブラウザ上の操作・スマホ表示・ホバーと、翌日の定刻実行は未確認。下記手順で公開前に確認してください。
- backendテストではStarletteのhttpx TestClientに関する非推奨警告が出ます。現行テストは通過しており、テスト用HTTPクライアントの移行は今後の対応です。

## 手動動作確認

1. PostgreSQLとバックエンド・フロントエンドを起動し、ダッシュボード・各期間のチャートを確認。
2. ポイントを追加し、評価額・損益・平均取得価格と投資マーカーが更新されることを確認。
3. 履歴画面の各項目を確認し、ページとバックエンドを再起動しても履歴が残ることを確認。
4. 同日の複数記録、履歴0件、スマホのカード表示、期間切り替え、マーカーのホバーを確認。
5. `POST /market-prices`を2回実行して1行だけ保存されることを確認。翌日の実行後、pgAdminで日次データの増加を確認。

## v1の注意点・公開前チェック

- **GLDとUSD/JPYによる概算であり、PayPayポイント運用の実際の評価額と一致しない可能性があります。** 実際のポイント残高や取引を同期しません。
- v1には認証・ユーザー分離がありません。接続した人は全履歴を閲覧・登録できます。一般公開前に認証またはアクセス制限を導入してください。CORSは認証の代わりにはなりません。
- 常駐サーバーで運用する場合は`--reload`を使わず、`uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1`をHTTPSのリバースプロキシ等の背後で実行します。Vercelでは前述の公開構成を使用します。
- 画面とAPIを別のoriginで公開する場合は`CORS_ORIGINS`と`VITE_API_BASE_URL`を設定して再ビルドします。Vercelの一体構成では設定不要です。
- APIキー、DBの最小権限、TLS、バックアップ、既存テーブルの一意制約、日次ジョブのログと失敗監視を確認してください。
- 外部APIの利用上限・データ遅延・休場日に依存します。任意の過去日を登録しても、価格は登録時点の市場データを使用します。
- ビルド時の約600kBのチャンクサイズ警告はv1の既知事項です。今後必要に応じてコード分割を検討します。
- `.env`、仮想環境、`__pycache__`、`node_modules`、`dist`はGit管理対象外です。`.env.example`とロックファイルは管理します。

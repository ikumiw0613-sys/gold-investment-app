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
| `VITE_API_BASE_URL` | **`frontend/.env`**。APIのベースURL | `http://127.0.0.1:8000` |

接続文字列の形式は `postgresql+psycopg2://USER:PASSWORD@HOST:5432/DB_NAME` です。
パスワードの特殊文字はURLエンコードしてください。実際の認証情報はGitへ追加しません。
ルート`.env.example`は全キーの一覧です。Vite用の値は`frontend/.env`へ設定してください。
バックエンドはプロセス環境変数 → ルート`.env` → 既存の`backend/.env`の優先順位で読み込みます。
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

- 起動時に`investment_records`と`market_prices`の未作成テーブルを作成します。
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
- 本番は`--reload`を使わず、`uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1`をHTTPSのリバースプロキシ等の背後で実行します。
- 本番の画面originを`CORS_ORIGINS`へ設定し、`frontend/.env.production`またはビルド環境に`VITE_API_BASE_URL`を設定して再ビルドします。API URLを変えただけでは既存ビルドは更新されません。
- APIキー、DBの最小権限、TLS、バックアップ、既存テーブルの一意制約、日次ジョブのログと失敗監視を確認してください。
- 外部APIの利用上限・データ遅延・休場日に依存します。任意の過去日を登録しても、価格は登録時点の市場データを使用します。
- ビルド時の約600kBのチャンクサイズ警告はv1の既知事項です。今後必要に応じてコード分割を検討します。
- `.env`、仮想環境、`__pycache__`、`node_modules`、`dist`はGit管理対象外です。`.env.example`とロックファイルは管理します。

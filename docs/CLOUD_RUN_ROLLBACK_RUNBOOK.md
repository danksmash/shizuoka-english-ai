# Cloud Run 本番ロールバック Runbook

このRunbookは、授業・研究運用中にCloud Run本番で重大な不具合が発生した場合に、**原因調査より先に正常状態へ復旧する**ための手順です。

対象:

- Project: `shizuoka-english-ai`
- Service: `shizuoka-english-ai`
- Region: `asia-northeast1`
- Production URL: `https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app`

## 原則

1. **Firestore等の研究データは削除・巻き戻し・書き換えない。**
2. ロールバックはCloud Runの**トラフィックを、最後に正常確認済みのrevisionへ戻すだけ**にする。
3. 単に「1つ前のrevision」ではなく、GitHub Actionsのproduction smokeが成功したrevisionを選ぶ。
4. 復旧後に原因調査を行う。原因調査中に本番障害を長引かせない。
5. 破壊的なデータ移行が行われた直後は、古いrevisionとの互換性を確認してから切り替える。

## 0. ロールバック判断

次のいずれかが発生し、通常の再読込や一時的な外部API障害ではない場合にロールバックを検討する。

- 児童が対話を開始・終了できない
- session保存が失敗する
- 認証・研究者画面が利用不能
- Research Dashboardの主要集計が明らかに破損
- 本番health / smokeが失敗
- 最新deploy直後から再現性のある重大不具合が発生

軽微な文言・余白など、授業や研究データを妨げない問題ではロールバックしない。

## 1. 現在の状態を記録

ロールバック前に、最低限次を記録する。

- 発生時刻
- 症状
- 現在のmain commit SHA
- 現在トラフィックを受けているrevision
- 戻す予定の正常revision

現在のトラフィック:

```bash
gcloud run services describe shizuoka-english-ai \
  --project shizuoka-english-ai \
  --region asia-northeast1 \
  --format='yaml(status.latestReadyRevisionName,status.traffic,status.url)'
```

revision一覧:

```bash
gcloud run revisions list \
  --service shizuoka-english-ai \
  --project shizuoka-english-ai \
  --region asia-northeast1 \
  --sort-by='~metadata.creationTimestamp' \
  --format='table(metadata.name,metadata.creationTimestamp,status.conditions[0].status,spec.containers[0].image)'
```

## 2. 戻すrevisionを決める

GitHub Actionsの **Deploy production to Cloud Run** が成功し、その後のproduction smokeも成功したcommitに対応するrevisionを選ぶ。

**「直前revisionだから」という理由だけでは選ばない。**

可能なら、対象revisionの環境変数に記録された `APP_BUILD` とGitHub commit SHAを照合する。

```bash
gcloud run revisions describe TARGET_REVISION \
  --project shizuoka-english-ai \
  --region asia-northeast1 \
  --format='yaml(metadata.name,spec.containers[0].env,status.conditions)'
```

## 3. トラフィックを正常revisionへ戻す

`TARGET_REVISION` を実際のrevision名へ置き換える。

```bash
gcloud run services update-traffic shizuoka-english-ai \
  --project shizuoka-english-ai \
  --region asia-northeast1 \
  --to-revisions TARGET_REVISION=100
```

**revisionの削除はしない。**  
問題revisionも原因調査用に残す。

## 4. 非破壊smokeで復旧確認

### health

```bash
curl --fail --silent --show-error \
  https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app/api/health
```

確認項目:

- `"status":"ok"`
- AI設定が正常
- TTS設定が正常
- management設定が正常
- `build` が戻したrevisionの想定commitと一致

### Research Dashboardの認証境界

未認証で研究データが取得できないことを確認する。**データは書き込まない。**

```bash
curl --silent --show-error \
  -o /tmp/rollback-dashboard-probe.json \
  -w '%{http_code}\n' \
  'https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app/api/management/research.dashboard?dataScope=main'
```

期待値: `401`

### 管理画面配信

```bash
curl --fail --silent --show-error \
  https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app/management \
  | grep -q '研究データ管理'
```

この段階では、session作成、CSV import、質問紙ingest等の**書込み操作をsmokeに使わない**。

## 5. 復旧後

復旧を確認したら、次の順で進める。

1. 障害発生commitと正常revisionの差分を確認
2. 根本原因を特定
3. 修正ブランチで対象QA群を実行
4. PRでFull QA + build
5. mainへ統合
6. 通常のCloud Run deploy + production smoke
7. 新revisionが正常ならロールバック状態を解除

通常deployが成功すれば、最新revisionへ100%トラフィックが戻る。

## 6. やってはいけないこと

- Firestoreのsession / reflection / questionnaireをロールバックのために削除する
- raw研究データを古い状態へ書き戻す
- 原因不明のまま複数revisionを削除する
- smokeのために本番研究データを作成・変更する
- 「最新ではない」という理由だけで正常revisionを再deployする
- 障害中に複数の修正を同時投入する

## 7. 完了条件

ロールバックは次を満たしたら完了とする。

- 正常確認済みrevisionへ100%トラフィックが向いている
- `/api/health` が正常
- Research Dashboard認証境界が維持されている
- 管理画面が配信されている
- 研究データを書き換えていない
- 障害commit / revision / 症状が記録されている

その後に原因修正へ進む。

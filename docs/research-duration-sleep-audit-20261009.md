# スリープ・長時間セッション：研究データの読み取り専用監査手順（2026-10-09）

## 実施前提
- 研究期間中のFirestore原本は削除・修正・上書きしない。
- RQ1（Persona選択）、RQ2・RQ3（児童発話系列）の分析対象を、時間異常だけを理由に変更しない。
- 対話時間の品質をWPM・ターン数/分だけ独立して判定する。
- 児童の氏名・学習コード・全文発話は監査報告に出力しない。

## 監査する対象と範囲
研究者ダッシュボードの**正式研究Export**から `sessions.csv` を出力する。日付・学級・学校条件・Phaseで対象が縮小されていないことを確認する。全件監査では「全校（またはall）」「全学級」「全期間」「completeのみ＝OFF」を選ぶ。Pilot等が混ざる場合は研究対象とpilotを区別して報告する。最新20件／選択日の一覧だけでは全件監査にならない。

## 実行（CSVファイルはリポジトリへpushしない）
```bash
npm ci
npm run audit:research-duration -- /path/to/sessions.csv > duration-audit.json
```

必要な列は `session_id,class_id,local_date,target_duration_minutes,actual_duration_seconds,child_total_words,child_turn_count`。
`dialogue_utterance_count,ai_turn_count,lesson_context_final,lesson_context_inferred,duration_quality` はあると精度・範囲が改善する。

### 主な結果
- `quality.invalid`：時間が利用できない（例：非正値、3600秒上限）件数
- `quality.needs_review`：時間異常候補（例：600秒以上、選択時間＋180秒超）件数
- `quality.capped3600`：旧3600秒上限に到達した件数
- `overall.before/after`：時間品質を適用する前後の全件WPM・ターン数/分
- `lessonOnly.before/after`：CSV内の授業内判定を用いた授業内セッションの比較
- `byClass`・`byDate`：学級別、日付別の候補と平均の差

`before`／`after`は影響評価用であり、未検証の実測値を補正したものではない。正式グラフの有効セッション集合、手動除外、Phase指定などと揃える場合は追加照合が必要。

## 誤った「60分」の処置
1. 原記録`actual_duration_seconds=3600`を保持。
2. 分母に使う秒数`analysis_duration_seconds`は空欄（無効）。
3. 発話本文・児童turn・Persona選択は独立に有効性を判定。
4. 当該セッションの`systemEvents`と最終児童／AI発話時刻で中断状況を確認する。ログから正確な活動時間を証明できなければ任意の2分等へ換算しない。
5. 旧CSVと改修版CSVの双方についてデータ件数・品質判定・計算式を記録する。

## 本番反映前の実機確認
1分・2分・3分・5分をそれぞれ通常終了し、正常な時間・音声認識・Azure TTS・振り返りが保持されるか確認する。
開始後に5秒／29秒画面を隠して復帰させ、途中中止と誤判定されないことを確認する。
開始後に30秒以上画面を隠して復帰させ、中断イベント、ログ保持、復帰メッセージ、経過時間への混入がないことを確認する。
ChromeOSの蓋を閉じてスリープ→60秒後復帰でも、途中中止になるか確認する。
通信不通・強制終了では通知が失敗し得るため、最後の保存済みチェックポイントを確認する。
研究者用CSVの`duration_quality`、`analysis_duration_seconds`とダッシュボードグラフを突き合わせる。

※ 今回のPRはDraftであり、ChromeOS実機検証・本番全件監査に合格するまで本番へ反映しない。

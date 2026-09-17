# 研究データ・クリーニング記録

研究用データの除外判断を再現可能にするための記録。raw Firestoreデータは削除・上書きせず保持する。

## 2026-09-17 — participant identity uncertain

- research_id: `R373562`
- class_id: `5-3`
- 対象session:
  - `session_cf4973c1cf96495eb7057c32fd99cd32`
  - `session_30153c7998f0401eb6bd10d062a05442`
- 状況: 同一research_id・同一Persona・同一topicのcomplete sessionが約4秒差で開始し、約116.6秒間重複して進行していた。両sessionには異なる児童発話・AI応答・session_finish・reflection_submitが記録されている。
- 教師による確認: 学習者IDが友達と共有され、複数児童が同じIDを使用した可能性が高いと判断した。
- 除外理由: どちらのsessionが本来の研究参加児童による対話かを保証できず、参加者同一性が不確実であるため。
- 研究上の扱い:
  - raw sessionは保持する。
  - 両sessionを主分析・厳格分析・Phase比較・研究CSV/ZIPから除外する。
  - Dashboardでは「研究分析対象外（手動除外）」として明示する。
  - 除外理由コード: `participant_identity_uncertain_id_shared`
- 再発防止: 教師から児童へ、学習者IDは本人のみが使用し、友達と共有しないよう口頭指導する。

### データ管理上の注記

この研究記録には学習者ID、内部studentId、氏名、出席番号等の直接対応情報を記載しない。研究用匿名IDとsession_idのみを使用する。

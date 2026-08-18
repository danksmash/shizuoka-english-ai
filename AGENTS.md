# AI Agent Persistent Project Rules

## 1. 【絶対厳守】留学生イラスト（9名）および背景イラストの完全固定ルール
- **現在の留学生イラスト（全9名）および背景画像はユーザーにより確定され、完全固定されています。**
- **ユーザーから明示的に「イラストを変更してください」「イラストを再生成してください」という直接の指示があった場合を除き、いかなる場合（アプリの改修、新機能追加、レイアウト変更、リファクタリング、バグ修正、高速化、再起動等）も勝手に留学生イラストや背景画像を変更・再生成・別ファイルへの差し替え・ランダム化・削除を行ってはなりません。**
- イラストや背景を変更する権限は、ユーザーの明示的な指示があった時のみに限定されます。

### 固定対象のイラストアセット一覧（全9名 ＋ 背景）
1. 🇬🇧 Oliver Wright (`/images/oliver_uk.jpg`) - アニメ風バストアップ (MD5: `6713a797e9378d3e99515610faa33910`)
2. 🇺🇸 Emma Johnson (`/images/emma_usa.jpg`) - アニメ風バストアップ (MD5: `5e4685b0150ae37def6b4db9bedf1f92`)
3. 🇦🇺 Liam Walker (`/images/liam_aus.jpg`) - アニメ風バストアップ (MD5: `139961efbcdbba8cc63f8bdb613b5702`)
4. 🇨🇦 Chloe Tremblay (`/images/chloe_can.jpg`) - アニメ風バストアップ (MD5: `bbf978b5fc9b4702b5bd44c7ff845396`)
5. 🇭🇺 Bence Kovács (`/images/bence_hun.jpg`) - アニメ風バストアップ (MD5: `193e3a9623438befb89fe429017fa7ac`)
6. 🇵🇱 Zofia Nowak (`/images/zofia_pol.jpg`) - アニメ風バストアップ (MD5: `505b916411a3132a9b52a66ffb90d817`)
7. 🇧🇩 Rahul Hasan (`/images/rahul_ban.jpg`) - アニメ風バストアップ (MD5: `8154df15db89152df41d096c882d2949`)
8. 🇻🇳 Linh Nguyen (`/images/linh_vie.jpg`) - アニメ風バストアップ (MD5: `95724dada000e45c1ce0d315c04d52c3`)
9. 🇲🇲 Aung Min (`/images/aung_mya.jpg`) - アニメ風バストアップ (MD5: `e50bd7cd3d383a59b9ee835f780803c5`)
- 🌸 背景バナー (`/images/shizuoka_exchange_banner.jpg`) (MD5: `fa47046a6ab6f1020b580cefa8c92107`)

### バックアップ配置場所
- `src/assets/fixed_images/` に原本がバックアップ保存されています。
- 静的ファイルは `public/images/` および本番配信用 `dist/images/` に配置されます。

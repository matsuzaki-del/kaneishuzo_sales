# デプロイガイド (Vercel編)

このプロジェクトをインターネット上に公開（デプロイ）するための手順です。

## 1. 準備
- **GitHub アカウント**: まだ持っていない場合は [github.com](https://github.com) で作成してください。
- **Vercel アカウント**: [vercel.com](https://vercel.com) で GitHub アカウントを使ってログインしてください。

## 2. GitHubへのプッシュ
ターミナルで以下のコマンドを実行します。

```bash
git init
git add .
git commit -m "Initial commit: AI Sales Forecasting System"
# GitHubで作成したリポジトリのURLを指定
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git
git branch -M main
git push -u origin main
```

## 3. Vercelでの設定
1. Vercelのダッシュボードで「**Add New**」→「**Project**」をクリック。
2. 先ほどプッシュしたリポジトリを選択して「**Import**」。
3. **Environment Variables** (環境変数) セクションで、以下の2つを必ず追加してください。
   - `DATABASE_URL`: (Supabaseの接続文字列)
   - `GEMINI_API_KEY`: (Google AIのAPIキー)
4. 「**Deploy**」ボタンを押すと、数分でURLが発行されます。

## 4. データベースの接続（注意点）
Supabaseの接続制限を避けるため、Vercelから接続する際は接続プールを使用するか、Prismaの設定を最適に保つ必要があります。現在の設定で問題なく動作するはずです。

---
**作成者: Antigravity**

# Medarot-J

メダロットバトルゲームのJavaScript実装です。ECSアーキテクチャを採用したターン制バトルシステムです。

## プロジェクト構造

```
scripts/
├── main.js              # エントリーポイント、ゲーム初期化
├── ecs.js               # ECSコア実装（World, Entity, Component, System）
├── components.js        # ゲームコンポーネント定義
├── constants.js         # 定数定義
├── config.js            # 設定値
├── events.js            # イベント定義
├── battleUtils.js       # バトル関連ユーティリティ（再エクスポート）
├── ai/                  # AI関連モジュール
│   ├── targetingStrategies.js  # ターゲット決定戦略
│   └── targetingUtils.js       # ターゲット決定ユーティリティ
├── utils/               # 汎用ユーティリティ
│   └── battleUtils.js          # バトル計算ユーティリティ
└── systems/             # ゲームシステム
    ├── actionSystem.js         # 行動実行システム
    ├── aiSystem.js             # AIシステム
    ├── baseSystem.js           # 基底システムクラス
    ├── domFactorySystem.js     # DOM生成システム
    ├── gameFlowSystem.js       # ゲームフロー管理
    ├── gaugeSystem.js          # ゲージ管理システム
    ├── historySystem.js        # 履歴管理システム
    ├── inputSystem.js          # 入力システム
    ├── movementSystem.js       # 移動システム
    ├── renderSystem.js         # レンダリングシステム
    ├── stateSystem.js          # 状態管理システム
    ├── turnSystem.js           # ターン管理システム
    └── viewSystem.js           # ビューシステム
```

## 主な機能

- **ECSアーキテクチャ**: Entity-Component-Systemパターンによる柔軟な設計
- **ターン制バトル**: 戦略的なバトルシステム
- **AIキャラクター**: さまざまな性格のメダロットAI
- **リアルタイムUI**: DOM操作による動的なインターフェース

## ゲームルール

- 各チーム3体のメダロットが戦います
- メダロットは頭部、右腕、左腕、脚部の4つのパーツを持ちます
- 各パーツはHPとアクション（攻撃/移動）を持ちます
- ゲージが満タンになると行動可能になります
- 頭部が破壊されるとそのメダロットは戦闘不能になります

## AI性格タイプ

- **HUNTER**: 最もHPが低いパーツを狙う
- **CRUSHER**: 最もHPが高いパーツを狙う
- **JOKER**: ランダムにパーツを選択
- **COUNTER**: 自分を最後に攻撃した敵を狙う
- **GUARD**: 味方リーダーを最後に攻撃した敵を狙う
- **FOCUS**: 前回攻撃したパーツを集中攻撃
- **ASSIST**: 味方が最後に攻撃した敵を狙う
- **LEADER_FOCUS**: 常に敵リーダーを狙う
- **RANDOM**: 完全にランダム

## 開発者向け情報

### ファイル分割の原則

- `utils/`: 純粋なユーティリティ関数
- `ai/`: AI関連のロジック
- `systems/`: ゲームシステム（ECSパターン）
- メインの`scripts/`直下: コア機能と設定

### コーディング規約

- JSDocコメントを適切に使用
- 関数は単一責任の原則に従う
- 循環依存を避ける
- イベント駆動アーキテクチャを採用

## 実行方法

1. リポジトリをクローン
2. `index.html`をブラウザで開く
3. ゲームが自動的に開始されます

## ライセンス

このプロジェクトは教育目的で作成されています。

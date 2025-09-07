# Medarot-J

メダロットバトルゲームのJavaScript実装です。ECSアーキテクチャを採用したターン制バトルシステムです。

## プロジェクト構造

```
scripts/
├── main.js              # エントリーポイント、ゲーム初期化
├── core/                # ECSとアーキテクチャのコア機能
│   ├── world.js         # ECSコア実装 (旧ecs.js)
│   ├── components.js    # ゲームコンポーネント定義
│   └── baseSystem.js    # 基底システムクラス
├── common/              # ゲーム全体で共有される設定・定数
│   ├── config.js        # 設定値
│   ├── constants.js     # 定数定義
│   └── events.js        # イベント定義
├── systems/             # ゲームロジックシステム
│   ├── actionSystem.js
│   ├── aiSystem.js
│   ├── gameFlowSystem.js
│   ├── gaugeSystem.js
│   ├── historySystem.js
│   ├── movementSystem.js
│   ├── stateSystem.js
│   └── turnSystem.js
├── ui/                  # UI関連システム
│   ├── domFactorySystem.js
│   ├── inputSystem.js
│   ├── renderSystem.js
│   └── viewSystem.js
├── ai/                  # AI関連モジュール
│   ├── targetingStrategies.js
│   └── targetingUtils.js
└── utils/               # 汎用ユーティリティ
    └── battleUtils.js
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

/**
 * @file States.js
 * @description ECSにおける状態コンポーネント群。
 * リクエスト駆動から状態駆動への移行に伴い導入。
 */

export class ModalState {
  constructor() {
    this.isOpen = false; // モーダルが開いているか
    this.type = null; // モーダルの種類 (例: 'SELECTION', 'MESSAGE')
    this.data = {}; // モーダルに渡すデータ
    this.messageSequence = null; // 表示するメッセージの配列
    this.taskId = null; // 関連するタスクID
    this.onComplete = null; // モーダル完了時のコールバック
    this.priority = 'normal'; // モーダルの優先度 ('normal', 'high', 'low')
    this.isNew = true; // 新しいモーダルとして扱う
    this.isCompleted = false; // モーダルが完了したか
  }
}

export class ActionState {
  constructor() {
    this.state = 'idle'; // 'idle', 'selected', 'processing', 'completed'
    this.entityId = null; // アクションを行ったエンティティID
    this.partKey = null; // アクションを行う部位
    this.targetId = null; // 対象のエンティティID
    this.targetPartKey = null; // 対象の部位
  }
}

export class PlayerInputState {
  constructor() {
    this.isActive = false;
    this.entityId = null;
  }
}

export class ActionRequeueState {
  constructor() {
    this.isActive = false;
    this.entityId = null;
  }
}

export class AnimationState {
  constructor() {
    this.type = null; // 'HP_BAR', 'EFFECT', 'UI_ANIMATION' など
    this.data = {};
  }
}

export class UIStateUpdateState {
  constructor() {
    this.type = null; // 'ANIMATION_COMPLETED' など
    this.data = {};
    this.isCompleted = false;
  }
}
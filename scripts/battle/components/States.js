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
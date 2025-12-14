/**
 * @file Requests.js
 * @description ECSの処理フロー制御用のリクエスト/結果コンポーネント群。
 */

export class CombatRequest {
    constructor() {}
}

export class CombatResult {
    constructor(data) {
        this.data = data;
    }
}

export class VisualSequenceRequest {
    constructor(context) {
        this.context = context;
    }
}

/**
 * 演出データの生成結果（未変換の演出指示リスト）
 * VisualSequenceSystem -> BattleSequenceSystem
 */
export class VisualSequenceResult {
    constructor(sequence) {
        this.sequence = sequence;
    }
}

/**
 * 実行可能なタスクシーケンス（変換済みのコンポーネント定義リスト）
 * BattleSequenceSystem -> TaskSystem
 */
export class VisualSequence {
    constructor(tasks) {
        this.tasks = tasks;
    }
}

/**
 * AIへの行動決定要求
 * AiSystemが処理し、ActionService経由で結果を反映する
 */
export class AiActionRequest {
    constructor() {}
}
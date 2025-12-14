/**
 * @file Requests.js
 * @description ECSの処理フロー制御用のリクエスト/結果コンポーネント群。
 * これらをエンティティに付与することで、対応するSystemが処理を開始する。
 */

/**
 * 戦闘計算を要求するコンポーネント
 * CombatSystemがこれを検知して処理する
 */
export class CombatRequest {
    constructor() {
        // タグとして機能するため、データは最低限
        // 処理対象はコンポーネントが付与されたエンティティ自身(Attacker)とする
    }
}

/**
 * 戦闘計算が完了したことを示すコンポーネント
 * CombatSystemが付与し、BattleSequenceSystemなどが検知する
 */
export class CombatResult {
    /**
     * @param {object} data - 計算結果データ (BattleResult)
     */
    constructor(data) {
        this.data = data;
    }
}

/**
 * 演出シーケンス（タスクリスト）の生成を要求するコンポーネント
 * VisualSequenceSystemがこれを検知して処理する
 */
export class VisualSequenceRequest {
    /**
     * @param {object} context - 戦闘コンテキスト、またはキャンセル情報など
     */
    constructor(context) {
        this.context = context;
    }
}

/**
 * 生成された演出シーケンスを保持するコンポーネント
 * VisualSequenceSystemが付与し、BattleSequenceSystemが実行する
 */
export class VisualSequence {
    /**
     * @param {Array} tasks - 生成されたタスク定義の配列
     */
    constructor(tasks) {
        this.tasks = tasks;
    }
}
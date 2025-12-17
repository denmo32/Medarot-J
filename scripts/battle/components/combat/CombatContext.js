/**
 * @file CombatContext.js
 * @description 戦闘計算の途中経過と結果を保持するデータコンポーネント。
 * System側で参照されているプロパティ名(appliedEffects, eventsToEmit等)に合わせて修正。
 */
export class CombatContext {
    constructor() {
        // 基本情報
        this.attackerId = null;
        this.action = null;
        this.attackerInfo = null;
        this.attackerParts = null;
        this.attackingPart = null;
        this.isSupport = false;

        // ターゲット情報
        this.intendedTargetId = null;
        this.intendedTargetPartKey = null;
        this.finalTargetId = null;
        this.finalTargetPartKey = null;
        this.guardianInfo = null;
        this.targetLegs = null;

        // 計算結果
        this.outcome = null; // 命中、クリティカル判定など
        
        // 制御フラグ
        this.shouldCancel = false;
        this.cancelReason = null;
        
        // 結果集約用
        this.appliedEffects = [];
        this.eventsToEmit = [];
        this.stateUpdates = [];
        this.interruptions = [];
    }
}
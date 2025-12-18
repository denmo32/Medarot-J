/**
 * @file CombatContext.js
 * @description 戦闘計算のコンテキスト。
 * attackingPart は QueryService.getPartData で取得されたオブジェクトを保持する。
 */
export class CombatContext {
    constructor() {
        this.attackerId = null;
        this.action = null;
        this.attackerInfo = null;
        this.attackerParts = null;
        this.attackingPart = null; // Snapshot object
        this.isSupport = false;

        this.intendedTargetId = null;
        this.intendedTargetPartKey = null;
        this.finalTargetId = null;
        this.finalTargetPartKey = null;
        this.guardianInfo = null;
        this.targetLegs = null;

        this.outcome = null;
        
        this.shouldCancel = false;
        this.cancelReason = null;
        
        this.appliedEffects = [];
        this.eventsToEmit = [];
        this.stateUpdates = [];
        this.interruptions = [];
    }
}
/**
 * @file ActionExecutionSystem.js
 * @description アクションの実行処理（命中判定、エフェクト生成）を一元管理するシステム。
 * パーツが持つ振る舞い（AccuracyBehavior, ImpactBehavior）に基づいて処理を汎用化。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    BattleSequenceState, CombatContext, TargetResolved,
    InCombatCalculation, ProcessingEffects, GeneratingVisuals
} from '../../components/index.js';
import { CombatService } from '../../services/CombatService.js';

export class ActionExecutionSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // ターゲット解決済みかつ計算フェーズのエンティティを処理
        const entities = this.world.getEntitiesWith(
            BattleSequenceState, 
            InCombatCalculation, 
            TargetResolved, 
            CombatContext
        );
        
        for (const entityId of entities) {
            this._executeAction(entityId);
        }
    }

    /**
     * アクションの実行ロジック
     * @param {number} entityId - アクション実行者のID
     */
    _executeAction(entityId) {
        const ctx = this.world.getComponent(entityId, CombatContext);
        
        if (ctx.shouldCancel) {
             this._handleCancel(entityId, ctx);
             return;
        }

        // 1. 命中判定・結果計算
        // 内部的には ctx.attackingPart.accuracyType を参照してロジックを切り替え可能
        CombatService.calculateHitOutcome(this.world, ctx);

        // 2. エフェクトエンティティの生成
        // 内部的には ctx.attackingPart.effects (ImpactBehaviorから抽出されたデータ) をループ処理
        CombatService.spawnEffectEntities(this.world, ctx);

        // 3. パイプライン遷移: エフェクト処理（DamageSystem等）の完了待ちへ
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new ProcessingEffects());
    }

    /**
     * 中断処理
     */
    _handleCancel(entityId, ctx) {
        const state = this.world.getComponent(entityId, BattleSequenceState);
        
        const resultData = CombatService.buildCancelledResultData(ctx);
        state.contextData = resultData;

        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, TargetResolved);
        this.world.removeComponent(entityId, InCombatCalculation);
        
        // メッセージ表示のため演出生成フェーズへ
        this.world.addComponent(entityId, new GeneratingVisuals());
    }
}
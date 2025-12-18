/**
 * @file ActionExecutionSystem.js
 * @description アクションの実行処理（命中判定、エフェクト生成）を一元管理するシステム。
 * ShootSystem, MeleeSystem, SupportActionSystem を統合。
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
        // アクションの種類に関わらず、計算フェーズでターゲット解決済みのエンティティを処理
        // CombatContextを持っていることが前提
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

    _executeAction(entityId) {
        const ctx = this.world.getComponent(entityId, CombatContext);
        
        // キャンセル判定 (TargetingSystem等でフラグが立っている場合)
        if (ctx.shouldCancel) {
             this._handleCancel(entityId, ctx);
             return;
        }

        // 1. 命中判定・計算
        CombatService.calculateHitOutcome(this.world, ctx);

        // 2. エフェクトエンティティの生成
        CombatService.spawnEffectEntities(this.world, ctx);

        // 3. フェーズ遷移: 計算完了 -> エフェクト処理待ち
        this.world.removeComponent(entityId, InCombatCalculation);
        this.world.addComponent(entityId, new ProcessingEffects());
    }

    _handleCancel(entityId, ctx) {
        const state = this.world.getComponent(entityId, BattleSequenceState);
        
        // キャンセル用の結果データを構築
        const resultData = CombatService.buildCancelledResultData(ctx);
        state.contextData = resultData;

        // コンポーネントのクリーンアップとフェーズ遷移
        this.world.removeComponent(entityId, CombatContext);
        this.world.removeComponent(entityId, TargetResolved);
        this.world.removeComponent(entityId, InCombatCalculation);
        
        // 演出生成フェーズへスキップ (キャンセルメッセージ等の表示のため)
        this.world.addComponent(entityId, new GeneratingVisuals());
    }
}
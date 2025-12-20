/**
 * @file CombatResultSystem.js
 * @description エフェクト処理の完了を監視し、結果を集約してCombatResultを生成するシステム。
 * ProcessingEffectsタグを持つエンティティ（アクション実行者）を監視する。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    ProcessingEffects, BattleSequenceState, CombatContext, CombatResult, 
    GeneratingVisuals, InCombatCalculation
} from '../../components/index.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { CombatService } from '../../services/CombatService.js';

export class CombatResultSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const actors = this.getEntities(ProcessingEffects, BattleSequenceState, CombatContext);

        for (const actorId of actors) {
            this._checkCompletion(actorId);
        }
    }

    _checkCompletion(actorId) {
        // actorIdを親に持つエフェクトエンティティを検索
        const childEffects = this._findChildEffects(actorId);
        
        // まだ ApplyEffect を持っている（処理中）ものが残っていれば待機
        const hasPending = childEffects.some(e => this.world.getComponent(e, ApplyEffect));
        if (hasPending) return;

        // 全て EffectResult になっている場合、結果を収集
        const ctx = this.world.getComponent(actorId, CombatContext);
        const state = this.world.getComponent(actorId, BattleSequenceState);

        const appliedEffects = [];
        const events = [];
        const stateUpdates = [];

        for (const effectId of childEffects) {
            const result = this.world.getComponent(effectId, EffectResult);
            if (result && result.data) {
                appliedEffects.push(result.data);
                if (result.data.events) events.push(...result.data.events);
                if (result.data.stateUpdates) stateUpdates.push(...result.data.stateUpdates);
            }
            // エフェクトエンティティの削除
            this.world.destroyEntity(effectId);
        }

        // Context更新
        ctx.appliedEffects = appliedEffects;
        ctx.eventsToEmit.push(...events);
        ctx.stateUpdates.push(...stateUpdates);

        // CombatResult生成
        const resultData = CombatService.buildResultData(ctx);
        this.world.addComponent(actorId, new CombatResult(resultData));

        // フェーズ遷移
        this.world.removeComponent(actorId, CombatContext);
        this.world.removeComponent(actorId, ProcessingEffects);
        this.world.addComponent(actorId, new GeneratingVisuals());

        state.contextData = resultData;
    }

    _findChildEffects(parentId) {
        // Queryでキャッシュすべきだが、ここでは全エフェクトコンテキストから検索
        // 最適化ポイント: EffectContext の Query を保持する
        const entities = this.getEntities(EffectContext);
        return entities.filter(id => {
            const ctx = this.world.getComponent(id, EffectContext);
            return ctx.parentId === parentId;
        });
    }
}
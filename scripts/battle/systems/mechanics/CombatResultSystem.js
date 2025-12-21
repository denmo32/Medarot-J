/**
 * @file CombatResultSystem.js
 * @description エフェクト処理結果を集約してCombatResultを生成するシステム。
 * CombatService.buildResultData の責務を吸収。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    ProcessingEffects, BattleSequenceState, CombatContext, CombatResult, 
    GeneratingVisuals
} from '../../components/index.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { EffectType } from '../../common/constants.js';

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
        // 親が自分であるエフェクトコンテキストを探す
        const childEffects = this._findChildEffects(actorId);
        
        // まだ処理中のものがあれば待機
        const hasPending = childEffects.some(e => this.world.getComponent(e, ApplyEffect));
        if (hasPending) return;

        // 集計開始
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
            this.world.destroyEntity(effectId);
        }

        ctx.appliedEffects = appliedEffects;
        ctx.eventsToEmit.push(...events);
        ctx.stateUpdates.push(...stateUpdates);

        // 結果オブジェクト生成 (旧buildResultData)
        const summary = {
            isGuardBroken: ctx.appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: ctx.appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        // アクション完了後のクールダウン移行要求を追加
        ctx.stateUpdates.push({
            type: 'TransitionToCooldown',
            targetId: ctx.attackerId
        });

        const resultData = {
            attackerId: ctx.attackerId,
            attackingPartId: ctx.attackingPartId,
            intendedTargetId: ctx.intendedTargetId,
            targetId: ctx.finalTargetId,
            attackingPart: ctx.attackingPart,
            isSupport: ctx.isSupport,
            guardianInfo: ctx.guardianInfo,
            outcome: ctx.outcome || { isHit: false },
            appliedEffects: ctx.appliedEffects,
            summary,
            isCancelled: ctx.shouldCancel,
            interruptions: ctx.interruptions,
            eventsToEmit: ctx.eventsToEmit,
            stateUpdates: ctx.stateUpdates,
        };

        this.world.addComponent(actorId, new CombatResult(resultData));

        // フェーズ遷移
        this.world.removeComponent(actorId, CombatContext);
        this.world.removeComponent(actorId, ProcessingEffects);
        this.world.addComponent(actorId, new GeneratingVisuals());

        state.contextData = resultData;
    }

    _findChildEffects(parentId) {
        // Queryによるキャッシュが望ましいが、今回はフィルタリングで対応
        const entities = this.getEntities(EffectContext);
        return entities.filter(id => {
            const ctx = this.world.getComponent(id, EffectContext);
            return ctx.parentId === parentId;
        });
    }
}
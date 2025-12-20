/**
 * @file StatusEffectSystem.js
 * @description 状態異常やバフ処理。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { ActiveEffects, IsCharging, IsGuarding, Action } from '../../components/index.js';
import { EffectType, EffectScope, PlayerStateType, ActionCancelReason } from '../../common/constants.js';
import { TargetingService } from '../../services/TargetingService.js';
import { ActionCancelledRequest } from '../../../components/Events.js';

export class StatusEffectSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(ApplyEffect, EffectContext);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, ApplyEffect);
            
            switch (effect.type) {
                case EffectType.APPLY_SCAN:
                    this._processScan(entityId, effect);
                    break;
                case EffectType.APPLY_GLITCH:
                    this._processGlitch(entityId, effect);
                    break;
                case EffectType.APPLY_GUARD:
                    this._processApplyGuard(entityId, effect);
                    break;
            }
        }
    }

    _processScan(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { sourceId, attackingPart } = context;

        const params = effect.params || {};
        const valueSource = params.valueSource || 'might';
        const valueFactor = params.valueFactor || 0.1;
        const duration = params.duration || 3;

        const baseValue = attackingPart[valueSource] || 0;
        const scanBonusValue = Math.floor(baseValue * valueFactor);

        const targets = TargetingService.getValidAllies(this.world, context.targetId, true);
        const stateUpdates = [];

        targets.forEach(tid => {
            stateUpdates.push({
                type: 'CustomUpdateComponent',
                targetId: tid,
                componentType: ActiveEffects,
                customHandler: (activeEffects) => {
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
                    activeEffects.effects.push({
                        type: effect.type,
                        value: scanBonusValue,
                        duration: duration,
                        partKey: context.partKey
                    });
                }
            });
        });

        this._finishEffect(entityId, {
            type: EffectType.APPLY_SCAN,
            value: scanBonusValue,
            duration,
            stateUpdates
        });
    }

    _processGlitch(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { targetId } = context;

        if (!targetId) {
            this._finishEffect(entityId, { wasSuccessful: false });
            return;
        }

        const isCharging = this.world.getComponent(targetId, IsCharging);
        const isGuarding = this.world.getComponent(targetId, IsGuarding);
        const wasSuccessful = !!(isCharging || isGuarding);

        const stateUpdates = [];

        if (wasSuccessful) {
            const cancelRequestEntity = this.world.createEntity();
            this.world.addComponent(cancelRequestEntity, new ActionCancelledRequest({
                entityId: targetId,
                reason: ActionCancelReason.INTERRUPTED
            }));

            stateUpdates.push({
                type: 'ResetToCooldown',
                targetId: targetId,
                options: { interrupted: true }
            });
        }

        this._finishEffect(entityId, {
            type: EffectType.APPLY_GLITCH,
            targetId,
            wasSuccessful,
            stateUpdates
        });
    }

    _processApplyGuard(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { targetId, partKey, attackingPart } = context;

        const params = effect.params || {};
        const countSource = params.countSource || 'might';
        const countFactor = params.countFactor || 0.1;
        
        const baseValue = attackingPart[countSource] || 0;
        const guardCount = Math.floor(baseValue * countFactor);

        const action = this.world.getComponent(targetId, Action);
        const actualPartKey = action && action.partKey ? action.partKey : partKey;

        const stateUpdates = [];
        stateUpdates.push({
            type: 'TransitionState',
            targetId: targetId,
            newState: PlayerStateType.GUARDING 
        });

        stateUpdates.push({
            type: 'CustomUpdateComponent',
            targetId: targetId,
            componentType: ActiveEffects,
            customHandler: (activeEffects) => {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                activeEffects.effects.push({
                    type: EffectType.APPLY_GUARD,
                    value: guardCount,
                    count: guardCount,
                    partKey: actualPartKey,
                    duration: Infinity
                });
            }
        });

        this._finishEffect(entityId, {
            type: EffectType.APPLY_GUARD,
            targetId,
            value: guardCount,
            stateUpdates
        });
    }

    _finishEffect(entityId, resultData) {
        this.world.removeComponent(entityId, ApplyEffect);
        this.world.addComponent(entityId, new EffectResult(resultData));
    }
}
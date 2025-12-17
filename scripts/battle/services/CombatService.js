/**
 * @file CombatService.js
 * @description 戦闘計算の共通ロジックを提供するサービス。
 * パス修正: Action, CombatContext のインポートパス修正。
 */
import { Parts, PlayerInfo } from '../../components/index.js';
import { Action, CombatContext } from '../components/index.js';
import { CombatCalculator } from '../logic/CombatCalculator.js';
import { EffectRegistry } from '../definitions/EffectRegistry.js';
import { EffectType } from '../common/constants.js';

export class CombatService {
    
    /**
     * 戦闘コンテキストを初期化する
     * @param {World} world 
     * @param {number} attackerId 
     * @returns {CombatContext|null}
     */
    static initializeContext(world, attackerId) {
        const action = world.getComponent(attackerId, Action);
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        const attackerParts = world.getComponent(attackerId, Parts);
        
        if (!action || !attackerInfo || !attackerParts || !action.partKey) return null;
        
        const attackingPart = attackerParts[action.partKey];
        if (!attackingPart) return null;

        const ctx = new CombatContext();
        ctx.attackerId = attackerId;
        ctx.action = action;
        ctx.attackerInfo = attackerInfo;
        ctx.attackerParts = attackerParts;
        ctx.attackingPart = attackingPart;
        ctx.isSupport = attackingPart.isSupport;
        ctx.intendedTargetId = action.targetId;
        ctx.intendedTargetPartKey = action.targetPartKey;

        return ctx;
    }

    static calculateHitOutcome(world, ctx) {
        const calcContext = { ...ctx, world }; 
        ctx.outcome = CombatCalculator.calculateHitOutcomeFromContext(calcContext);
    }

    static calculateEffects(world, ctx) {
        const calcContext = { ...ctx, world };
        EffectRegistry.processAll(calcContext);
    }

    static applyEffects(world, ctx) {
        const applyContext = { ...ctx, world };
        const { appliedEffects, eventsToEmit, stateUpdates } = EffectRegistry.applyAll(ctx.rawEffects, applyContext);
        
        ctx.appliedEffects = appliedEffects;
        ctx.eventsToEmit.push(...eventsToEmit);
        ctx.stateUpdates.push(...stateUpdates);
    }

    static buildResultData(ctx) {
        const summary = {
            isGuardBroken: ctx.appliedEffects.some(e => e.isGuardBroken),
            isGuardExpired: ctx.appliedEffects.some(e => e.isExpired && e.type === EffectType.CONSUME_GUARD),
        };

        ctx.stateUpdates.push({
            type: 'TransitionToCooldown',
            targetId: ctx.attackerId
        });

        return {
            attackerId: ctx.attackerId,
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
    }
}
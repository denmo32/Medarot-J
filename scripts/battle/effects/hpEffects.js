/**
 * @file HP関連効果戦略定義
 */
import { PlayerInfo, Parts, Action } from '../components/index.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';

const DAMAGE = ({ world, sourceId, targetId, effect, part, partOwner, outcome }) => {
    if (!targetId || !outcome.isHit) {
        return null;
    }

    const targetParts = world.getComponent(targetId, Parts);
    if (!targetParts) return null;

    const finalDamage = CombatCalculator.calculateDamage({
        attackingPart: part,
        attackerLegs: partOwner.parts.legs,
        targetLegs: targetParts.legs,
        isCritical: outcome.isCritical,
        isDefenseBypassed: !outcome.isCritical && outcome.isDefended,
    });

    return {
        type: EffectType.DAMAGE,
        targetId: targetId,
        partKey: outcome.finalTargetPartKey, 
        value: finalDamage,
        isCritical: outcome.isCritical,
        isDefended: outcome.isDefended,
    };
};

const HEAL = ({ world, sourceId, targetId, effect, part }) => {
    if (targetId === null || targetId === undefined) {
        return {
            type: EffectType.HEAL,
            value: 0,
        };
    }

    const targetParts = world.getComponent(targetId, Parts);
    if (!targetParts) return null;
    
    const healAmount = part.might || 0;
    
    const targetPartKey = world.getComponent(sourceId, Action)?.targetPartKey;
    if (!targetPartKey) return null;

    return {
        type: EffectType.HEAL,
        targetId: targetId,
        partKey: targetPartKey,
        value: healAmount,
    };
};

export const hpEffects = {
    [EffectType.DAMAGE]: DAMAGE,
    [EffectType.HEAL]: HEAL,
};
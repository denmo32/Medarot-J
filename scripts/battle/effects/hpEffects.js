/**
 * @file HP関連効果戦略定義
 */
import { Action } from '../components/index.js';
// scripts/battle/effects/ -> ../../components/index.js
import { PlayerInfo, Parts } from '../../components/index.js';
import { EffectType } from '../../common/constants.js'; 
// scripts/battle/effects/ -> ../../common/constants.js
import { EffectType as CommonEffectType } from '../../common/constants.js';
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
        type: CommonEffectType.DAMAGE,
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
            type: CommonEffectType.HEAL,
            value: 0,
        };
    }

    const targetParts = world.getComponent(targetId, Parts);
    if (!targetParts) return null;
    
    const healAmount = part.might || 0;
    
    const targetPartKey = world.getComponent(sourceId, Action)?.targetPartKey;
    if (!targetPartKey) return null;

    return {
        type: CommonEffectType.HEAL,
        targetId: targetId,
        partKey: targetPartKey,
        value: healAmount,
    };
};

export const hpEffects = {
    [CommonEffectType.DAMAGE]: DAMAGE,
    [CommonEffectType.HEAL]: HEAL,
};
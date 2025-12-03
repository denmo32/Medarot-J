/**
 * @file HP関連効果戦略定義
 */
import { Action } from '../components/index.js';
import { PlayerInfo, Parts } from '../../components/index.js';
import { EffectType as CommonEffectType } from '../../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';

const DAMAGE = ({ world, sourceId, targetId, effect, part, partOwner, outcome }) => {
    if (!targetId || !outcome.isHit) {
        return null;
    }

    const targetParts = world.getComponent(targetId, Parts);
    if (!targetParts) return null;

    // 定義ファイルから計算パラメータを取得して渡す
    const calcParams = effect.calculation || {};

    const finalDamage = CombatCalculator.calculateDamage({
        world: world,
        attackerId: sourceId,
        attackingPart: part,
        attackerLegs: partOwner.parts.legs,
        targetLegs: targetParts.legs,
        isCritical: outcome.isCritical,
        isDefenseBypassed: !outcome.isCritical && outcome.isDefended,
        calcParams: calcParams // 追加
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
    
    // 定義ファイルから参照元パラメータを取得
    const powerStat = effect.calculation?.powerStat || 'might';
    const healAmount = part[powerStat] || 0;
    
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
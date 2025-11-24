/**
 * @file HP関連効果戦略定義
 * ダメージや回復など、エンティティのHPを直接操作する効果のロジックを定義します。
 */
import { PlayerInfo, Parts, Action } from '../components/index.js';
import { EffectType, PartKeyToInfoMap } from '../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';

/**
 * [ダメージ効果]: ターゲットにダメージを与えます。
 * 攻撃アクションの基本的な効果です。
 * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
 * @returns {object | null} 実行された効果の詳細を示すオブジェクト、または効果がない場合はnull
 */
const DAMAGE = ({ world, sourceId, targetId, effect, part, partOwner, outcome }) => {
    // ターゲットがいない、または攻撃が回避された場合は効果なし
    if (!targetId || !outcome.isHit) {
        return null;
    }

    const targetParts = world.getComponent(targetId, Parts);
    if (!targetParts) return null;

    // CombatCalculator を使用してダメージを計算
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
        partKey: outcome.finalTargetPartKey, // 防御された場合はターゲットパーツが変わる
        value: finalDamage,
        isCritical: outcome.isCritical,
        isDefended: outcome.isDefended,
    };
};

/**
 * [回復効果]: ターゲットのパーツHPを回復します。
 * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
 * @returns {object | null} 実行された効果の詳細を示すオブジェクト、または効果がない場合はnull
 */
const HEAL = ({ world, sourceId, targetId, effect, part }) => {
    // ターゲットがいない（＝回復対象がいない）場合
    if (targetId === null || targetId === undefined) {
        // メッセージ生成をMessageSystemに委譲するため、messageプロパティを削除
        return {
            type: EffectType.HEAL,
            value: 0,
        };
    }

    const targetParts = world.getComponent(targetId, Parts);
    if (!targetParts) return null;
    
    const healAmount = part.might || 0;
    
    // HEALER戦略などで決定されたターゲットパーツキーを取得する
    // ターゲット決定の責務はAI/Inputにあるため、ここでは Action コンポーネントから取得する
    const targetPartKey = world.getComponent(sourceId, Action)?.targetPartKey;
    if (!targetPartKey) return null;

    // メッセージ生成をMessageSystemに委譲するため、messageプロパティを削除
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

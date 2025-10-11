/**
 * @file アクション効果戦略定義
 * このファイルは、パーツのアクションによって引き起こされる多様な効果（ダメージ、状態変化など）の
 *具体的なロジック（アルゴリズム）を定義します。
 * 「ストラテジーパターン」を採用しており、新しい効果を追加する際は、
 * このファイルに新しい関数を追加し、パーツデータでそれを指定するだけで済みます。
 */
// ★修正: Parts コンポーネントをインポート
import { PlayerInfo, Parts } from '../core/components.js';
import { EffectType, EffectScope } from '../common/constants.js';
import { calculateDamage } from '../utils/combatFormulas.js';
import { getValidAllies } from '../utils/queryUtils.js';

/**
 * アクション効果戦略のコレクション。
 * @property {function} [effectType] - 効果の種類ごとの戦略関数。
 * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
 * @param {World} context.world - ワールドオブジェクト
 * @param {number} context.sourceId - 効果の発動者のエンティティID
 * @param {number} context.targetId - 効果の対象者のエンティティID
 * @param {object} context.effect - パーツデータに定義された効果オブジェクト
 * @param {object} context.part - 使用されたパーツオブジェクト
 * @param {object} context.partOwner - パーツ所有者のコンポーネント群 { info, parts }
 * @param {object} context.outcome - 事前に計算された戦闘結果 { isHit, isCritical, isDefended, finalTargetPartKey }
 * @returns {object | null} 実行された効果の詳細を示すオブジェクト、または効果がない場合はnull
 */
export const effectStrategies = {
    /**
     * [ダメージ効果]: ターゲットにダメージを与えます。
     * 攻撃アクションの基本的な効果です。
     */
    [EffectType.DAMAGE]: ({ world, sourceId, targetId, effect, part, partOwner, outcome }) => {
        // ターゲットがいない、または攻撃が回避された場合は効果なし
        if (!targetId || !outcome.isHit) {
            return null;
        }

        const targetParts = world.getComponent(targetId, Parts);
        if (!targetParts) return null;

        const finalDamage = calculateDamage(
            part,
            partOwner.parts.legs,
            targetParts.legs,
            outcome.isCritical,
            !outcome.isCritical && outcome.isDefended // isDefenseBypassed
        );

        return {
            type: EffectType.DAMAGE,
            targetId: targetId,
            partKey: outcome.finalTargetPartKey, // 防御された場合はターゲットパーツが変わる
            value: finalDamage,
            isCritical: outcome.isCritical,
            isDefended: outcome.isDefended,
        };
    },

    /**
     * [スキャン効果]: 味方チーム全体の命中精度を向上させます。
     * 援護アクションの代表的な効果です。
     */
    [EffectType.APPLY_SCAN]: ({ world, sourceId, effect, part }) => {
        const sourceInfo = world.getComponent(sourceId, PlayerInfo);
        if (!sourceInfo) return null;

        //効果量はパーツの威力(might)をベースに計算
        const scanBonusValue = Math.floor(part.might / 10);

        // 味方全体を取得
        const allies = getValidAllies(world, sourceId, true); // trueで自分自身も含む

        // 各味方のスキャンボーナスを更新
        allies.forEach(allyId => {
            const playerInfo = world.getComponent(allyId, PlayerInfo);
            if (playerInfo) {
                playerInfo.scanBonus = (playerInfo.scanBonus || 0) + scanBonusValue;
            }
        });
        
        return {
            type: EffectType.APPLY_SCAN,
            scope: EffectScope.ALLY_TEAM,
            value: scanBonusValue,
            message: `味方チーム全体の命中精度が${scanBonusValue}上昇！`
        };
    },
};
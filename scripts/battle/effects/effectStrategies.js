/**
 * @file アクション効果戦略定義
 * このファイルは、パーツのアクションによって引き起こされる多様な効果（ダメージ、状態変化など）の
 *具体的なロジック（アルゴリズム）を定義します。
 * 「ストラテジーパターン」を採用しており、新しい効果を追加する際は、
 * このファイルに新しい関数を追加し、パーツデータでそれを指定するだけで済みます。
 */
// ★修正: Action, GameState をインポート
import { PlayerInfo, Parts, ActiveEffects, Action, GameState } from '../core/components.js';
// ★修正: PartKeyToInfoMap, PlayerStateType をインポート
import { EffectType, EffectScope, PartKeyToInfoMap, PlayerStateType } from '../common/constants.js';
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
        // ★新規: 効果の持続ターン数を設定（ここでは仮に3ターンとする）
        const duration = 3;

        // 味方全体を取得
        const allies = getValidAllies(world, sourceId, true); // trueで自分自身も含む

        // ★変更: 各味方のActiveEffectsコンポーネントに効果を追加する
        allies.forEach(allyId => {
            const activeEffects = world.getComponent(allyId, ActiveEffects);
            if (activeEffects) {
                // 同じタイプの効果が既にあれば削除（重ねがけ不可のルール）
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_SCAN);
                // 新しい効果を追加
                activeEffects.effects.push({
                    type: EffectType.APPLY_SCAN,
                    value: scanBonusValue,
                    duration: duration,
                });
            }
        });
        
        return {
            type: EffectType.APPLY_SCAN,
            scope: EffectScope.ALLY_TEAM,
            value: scanBonusValue,
            duration: duration,
            message: `味方チーム全体の命中精度が${scanBonusValue}上昇！（${duration}ターン）`
        };
    },

    /**
     * ★新規: [回復効果]: ターゲットのパーツHPを回復します。
     */
    [EffectType.HEAL]: ({ world, sourceId, targetId, effect, part }) => {
        // ターゲットがいない（＝回復対象がいない）場合
        if (targetId === null || targetId === undefined) {
            return {
                type: EffectType.HEAL,
                value: 0,
                message: '行動失敗！　誰もダメージを受けていない！'
            };
        }

        const targetParts = world.getComponent(targetId, Parts);
        if (!targetParts) return null;
        
        const healAmount = part.might || 0;
        
        // ★修正: HEALER戦略などで決定されたターゲットパーツキーを取得する
        // ターゲット決定の責務はAI/Inputにあるため、ここでは Action コンポーネントから取得する
        const targetPartKey = world.getComponent(sourceId, Action)?.targetPartKey;
        if (!targetPartKey) return null;

        return {
            type: EffectType.HEAL,
            targetId: targetId,
            partKey: targetPartKey,
            value: healAmount,
            message: `${world.getComponent(targetId, PlayerInfo).name}の${PartKeyToInfoMap[targetPartKey]?.name}を${healAmount}回復！`
        };
    },

    /**
     * ★新規: [妨害効果]: ターゲットの行動予約を中断させ、強制的にクールダウンへ移行させます。
     */
    [EffectType.APPLY_GLITCH]: ({ world, targetId }) => {
        if (targetId === null || targetId === undefined) return null;

        const targetInfo = world.getComponent(targetId, PlayerInfo);
        const targetState = world.getComponent(targetId, GameState);
        if (!targetInfo || !targetState) return null;

        let wasSuccessful = false;
        let message = '';

        // ★修正: ターゲットが行動予約中またはガード中の場合のみ成功
        if (targetState.state === PlayerStateType.SELECTED_CHARGING || targetState.state === PlayerStateType.GUARDING) {
            wasSuccessful = true;
            message = `${targetInfo.name}は放熱へ移行！`;
        } else {
            wasSuccessful = false;
            message = '妨害失敗！　放熱中機体には効果がない！';
        }

        return {
            type: EffectType.APPLY_GLITCH,
            targetId: targetId,
            wasSuccessful: wasSuccessful,
            message: message,
        };
    },

    /**
     * ★新規: [ガード効果]: 自身に「ガード」状態を付与します。
     * 行動実行後、指定回数だけ味方への攻撃を肩代わりする状態になります。
     */
    [EffectType.APPLY_GUARD]: ({ world, sourceId, effect, part }) => {
        // ガード回数はパーツの威力(might)をベースに計算
        const guardCount = Math.floor(part.might / 10);
        const sourceAction = world.getComponent(sourceId, Action);
        if (!sourceAction) return null;
        
        // ガード効果をActiveEffectsコンポーネントに追加
        const activeEffects = world.getComponent(sourceId, ActiveEffects);
        if (activeEffects) {
            // 既存のガード効果は上書き
            activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            activeEffects.effects.push({
                type: EffectType.APPLY_GUARD,
                count: guardCount,
                partKey: sourceAction.partKey, // ガードに使用したパーツ
            });
        }
        
        return {
            type: EffectType.APPLY_GUARD,
            targetId: sourceId,
            value: guardCount,
            message: `味方への攻撃を${guardCount}回庇う！`
        };
    },
};
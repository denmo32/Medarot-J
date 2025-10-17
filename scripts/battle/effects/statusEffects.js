/**
 * @file 状態関連効果戦略定義 (新規作成)
 * スキャン、妨害、ガードなど、エンティティの状態や能力値を変化させる効果のロジックを定義します。
 */
import { PlayerInfo, ActiveEffects, GameState, Action } from '../core/components/index.js';
import { EffectType, EffectScope, PlayerStateType } from '../common/constants.js';
import { getValidAllies } from '../utils/queryUtils.js';

/**
 * [スキャン効果]: 味方チーム全体の命中精度を向上させます。
 * 援護アクションの代表的な効果です。
 * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
 * @returns {object | null} 実行された効果の詳細を示すオブジェクト、または効果がない場合はnull
 */
const APPLY_SCAN = ({ world, sourceId, effect, part }) => {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return null;

    //効果量はパーツの威力(might)をベースに計算
    const scanBonusValue = Math.floor(part.might / 10);
    // 効果の持続ターン数をデータ定義(effect.duration)から取得
    const duration = effect.duration || 3; // データに定義がなければデフォルトで3

    // 味方全体を取得
    const allies = getValidAllies(world, sourceId, true); // trueで自分自身も含む

    // 各味方のActiveEffectsコンポーネントに効果を追加する
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
};

/**
 * [妨害効果]: ターゲットの行動予約を中断させ、強制的にクールダウンへ移行させます。
 * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
 * @returns {object | null} 実行された効果の詳細を示すオブジェクト、または効果がない場合はnull
 */
const APPLY_GLITCH = ({ world, targetId }) => {
    if (targetId === null || targetId === undefined) return null;

    const targetInfo = world.getComponent(targetId, PlayerInfo);
    const targetState = world.getComponent(targetId, GameState);
    if (!targetInfo || !targetState) return null;

    let wasSuccessful = false;
    let message = '';

    // ターゲットが行動予約中またはガード中の場合のみ成功
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
};

/**
 * [ガード効果]: 自身に「ガード」状態を付与します。
 * 行動実行後、指定回数だけ味方への攻撃を肩代わりする状態になります。
 * @param {object} context - 戦略が必要とする情報を含むコンテキストオブジェクト
 * @returns {object | null} 実行された効果の詳細を示すオブジェクト、または効果がない場合はnull
 */
const APPLY_GUARD = ({ world, sourceId, effect, part }) => {
    // ガード回数の計算をデータ駆動に変更
    // effectに定義された倍率(countMultiplier)を使い、パーツの威力(might)に基づいて回数を算出
    const countMultiplier = effect.countMultiplier || 0.1; // データに定義がなければデフォルトで0.1 (mightの10%)
    const guardCount = Math.floor(part.might * countMultiplier);
    
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
};

export const statusEffects = {
    [EffectType.APPLY_SCAN]: APPLY_SCAN,
    [EffectType.APPLY_GLITCH]: APPLY_GLITCH,
    [EffectType.APPLY_GUARD]: APPLY_GUARD,
};
/**
 * @file 状態関連効果戦略定義
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

    // 効果量をデータ定義(powerSource)に基づいて計算
    const powerSource = effect.powerSource || 'might';
    const scanBonusValue = Math.floor(part[powerSource] / 10);
    const duration = effect.duration || 3;

    // 効果の適用対象となるエンティティのリストを取得
    const allies = getValidAllies(world, sourceId, true); 

    // EffectApplicatorSystemが効果を適用するため、ここでは計算結果を返すだけ
    // 各味方のActiveEffectsコンポーネントに効果を追加する処理はEffectApplicatorSystemに移譲
    
    return {
        type: EffectType.APPLY_SCAN,
        scope: EffectScope.ALLY_TEAM, // EffectApplicatorSystemがこのスコープを解釈する
        targetId: sourceId, // チームを特定するための起点ID
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
const APPLY_GUARD = ({ world, sourceId, effect, part, partKey }) => {
    // 効果量の計算をデータ定義に基づいて行う
    const powerSource = effect.powerSource || 'might';
    const countMultiplier = effect.countMultiplier || 0.1;
    const guardCount = Math.floor(part[powerSource] * countMultiplier);
    
    // 副作用を削除。この戦略は計算結果オブジェクトを返す責務に集中する。
    // ActiveEffectsコンポーネントへの追加はEffectApplicatorSystemが担当。
    
    return {
        type: EffectType.APPLY_GUARD,
        targetId: sourceId, // 効果の適用先は自分自身
        value: guardCount,
        partKey: partKey, // ガードに使用したパーツのキーを結果に含める
        message: `味方への攻撃を${guardCount}回庇う！`
    };
};

export const statusEffects = {
    [EffectType.APPLY_SCAN]: APPLY_SCAN,
    [EffectType.APPLY_GLITCH]: APPLY_GLITCH,
    [EffectType.APPLY_GUARD]: APPLY_GUARD,
};
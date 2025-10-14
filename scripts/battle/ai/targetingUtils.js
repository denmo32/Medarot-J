/**
 * @file ターゲット決定ユーティリティ
 * このファイルは、aiSystemとinputSystemから共通して利用される、
 * プレイヤーやAIの行動選択を処理し、ゲームイベントを発行するためのユーティリティ関数を提供します。
 */
import { PlayerInfo, GameState, Medal, Parts } from '../core/components.js';
import { PlayerStateType, EffectScope } from '../common/constants.js';
import { getValidEnemies, getValidAllies, isValidTarget } from '../utils/queryUtils.js';
import { getStrategiesFor } from './personalityRegistry.js';

/**
 * ★修正: ターゲット決定ロジックを大幅に単純化
 * この関数は、渡された「候補リスト」に対して、指定された「戦略」を実行することにのみ責任を持つ。
 * 候補リスト（敵か味方か）の作成責任は、呼び出し元（AiSystem, InputSystem）が担う。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {Function} strategy - 実行するターゲティング戦略関数
 * @param {number[]} candidates - ターゲット候補となるエンティティIDの配列
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId, strategy, candidates) {
    if (!strategy || !candidates || candidates.length === 0) {
        return null;
    }

    // 戦略の実行に必要なコンテキストを作成
    const strategyContext = {
        world,
        attackerId,
        candidates,
    };

    // 戦略を実行してターゲットを決定
    const target = strategy(strategyContext);

    // ターゲットが無効であればnullを返す
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        return null;
    }

    return target;
}
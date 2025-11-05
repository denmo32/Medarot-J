/**
 * @file ターゲット決定ユーティリティ
 * このファイルは、AIと思考ルーチン、そしてプレイヤーの入力補助から共通して利用される、
 * ターゲットを決定するためのユーティリティ関数を提供します。
 * 元々は `ai/` ディレクトリにありましたが、プレイヤーの補助機能にも使われるため汎用的な場所へ移動しました。
 */
import { isValidTarget } from '../utils/queryUtils.js';
import { GameEvents } from '../common/events.js';

/**
 * この関数は、指定された「戦略」を実行することにのみ責任を持つ。
 * ターゲット候補リストの作成は各戦略関数自身が担当します。
 * 
 * @param {World} world - ワールドオブジェクト
 * @param {number} attackerId - 攻撃者のエンティティID
 * @param {Function} strategy - 実行するターゲティング戦略関数
 * @param {string} strategyKey - 実行した戦略のキー (イベント発行用)
 * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
 */
export function determineTarget(world, attackerId, strategy, strategyKey) {
    if (!strategy) {
        return null;
    }

    // 戦略の実行に必要なコンテキストを作成
    const strategyContext = {
        world,
        attackerId,
    };

    // 戦略を実行してターゲットを決定
    const target = strategy(strategyContext);

    // ターゲットが無効であればnullを返す
    if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
        return null;
    }

    // 戦略が成功した場合、イベントを発行する
    if (strategyKey) {
        world.emit(GameEvents.STRATEGY_EXECUTED, {
            strategy: strategyKey,
            attackerId: attackerId,
            target: target
        });
    }

    return target;
}
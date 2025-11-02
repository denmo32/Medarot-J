/**
 * @file AI思考ルーチン条件評価関数
 * @description personalityRegistryで定義された`condition`データオブジェクトを解釈し、
 * AIの特定の思考ルーチンを実行可能にするかどうかを判定する関数のコレクション。
 * AiSystemからロジックを分離することで、AIの思考条件を独立したモジュールとして管理します。
 */
import { getValidAllies, findMostDamagedAllyPart } from '../utils/queryUtils.js';

/**
 * AI思考ルーチンの実行条件を評価する関数のコレクション。
 * @type {Object.<string, function({world: World, entityId: number, params: object}): boolean>}
 */
export const conditionEvaluators = {
    /**
     * 味方（自分を含む/含まない）の誰かがダメージを受けているかを評価します。
     * HEALER性格などが、回復行動を行うべきか判断するために使用します。
     * @param {object} context - 評価コンテキスト
     * @param {World} context.world - ワールドオブジェクト
     * @param {number} context.entityId - AIのエンティティID
     * @param {object} [context.params] - 追加パラメータ
     * @param {boolean} [context.params.includeSelf=false] - 評価に自分自身を含めるか
     * @returns {boolean} - ダメージを受けている味方がいればtrue
     */
    ANY_ALLY_DAMAGED: ({ world, entityId, params }) => {
        const { includeSelf = false } = params || {};
        const allies = getValidAllies(world, entityId, includeSelf);
        // 最もダメージを受けた味方パーツが存在するかどうかで判断（ダメージ量が0より大きいか）
        return findMostDamagedAllyPart(world, allies) !== null;
    },
    // 将来的な条件を追加する例:
    // IS_LEADER: ({ world, entityId }) => world.getComponent(entityId, PlayerInfo)?.isLeader,
};
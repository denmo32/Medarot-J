/**
 * @file 行動決定ユーティリティ
 * このファイルは、aiSystemとinputSystemから共通して利用される、
 * プレイヤーやAIの行動選択を処理し、ゲームイベントを発行するためのユーティリティ関数を提供します。
 */
import { GameEvents } from '../../common/events.js';
import { Parts } from '../components/index.js';
import { isValidTarget } from './queryUtils.js';
import { TargetTiming } from '../common/constants.js';

/**
 * 選択されたパーツに基づき、適切な行動決定イベントを発行します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {string} partKey - 選択されたパーツのキー
 * @param {{targetId: number, targetPartKey: string} | null} target - 決定されたターゲット情報
 */
export function decideAndEmitAction(world, entityId, partKey, target = null) {
    const parts = world.getComponent(entityId, Parts);

    if (!parts || !partKey || !parts[partKey] || parts[partKey].isBroken) {
        console.warn(`decideAndEmitAction: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
        world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
        return;
    }

    const selectedPart = parts[partKey];

    // 'post-move'アクションは移動後にターゲットを決めるため、ターゲット情報を無視して予約する
    if (selectedPart.targetTiming === TargetTiming.POST_MOVE) {
        world.emit(GameEvents.ACTION_SELECTED, {
            entityId,
            partKey,
            targetId: null,
            targetPartKey: null
        });
        return;
    }

    // ターゲットが必要なアクションで、ターゲットが無効な場合は警告
    if (selectedPart.targetScope?.endsWith('_SINGLE') && !isValidTarget(world, target?.targetId, target?.targetPartKey)) {
        console.error(`decideAndEmitAction: A valid target was expected but not found. Action may fail.`, {entityId, partKey, target});
        // それでも行動は予約する（実行時に再度チェックされる）
    }

    world.emit(GameEvents.ACTION_SELECTED, {
        entityId,
        partKey,
        targetId: target ? target.targetId : null,
        targetPartKey: target ? target.targetPartKey : null
    });
}
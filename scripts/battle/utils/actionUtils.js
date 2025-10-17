/**
 * @file 行動決定ユーティリティ
 * このファイルは、aiSystemとinputSystemから共通して利用される、
 * プレイヤーやAIの行動選択を処理し、ゲームイベントを発行するためのユーティリティ関数を提供します。
 */
import { GameEvents } from '../common/events.js';
import { Parts } from '../core/components/index.js';
import { isValidTarget } from './queryUtils.js';
// ★新規: TargetTiming定数をインポート
import { TargetTiming } from '../common/constants.js';

/**
 * 選択されたパーツに基づき、適切な行動決定イベントを発行します。
 * この関数は、aiSystemとinputSystemの重複ロジックを共通化するために作成されました。
 * パーツのアクションタイプ（格闘/射撃/回復など）を判別し、必要な検証を行った上で、
 * 適切なパラメータと共に `ACTION_SELECTED` イベントを発行します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {string} partKey - 選択されたパーツのキー
 * @param {{targetId: number, targetPartKey: string} | null} target - 事前に決定されたターゲット情報
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
    // ★リファクタリング: マージされた `targetTiming` プロパティを参照
    if (selectedPart.targetTiming === TargetTiming.POST_MOVE) {
        world.emit(GameEvents.ACTION_SELECTED, {
            entityId,
            partKey,
            targetId: null,
            targetPartKey: null
        });
        return;
    }

    // ★リファクタリング: ターゲットが必要なアクションかどうかの判定を `targetScope` で行う
    if (selectedPart.targetScope?.endsWith('_SINGLE') && !isValidTarget(world, target?.targetId, target?.targetPartKey)) {
        console.error(`decideAndEmitAction: A valid target was expected for a single-target action but not found. Action may fail.`, {entityId, partKey, target});
    }

    // それ以外のアクションは、決定されたターゲット情報と共にイベントを発行
    world.emit(GameEvents.ACTION_SELECTED, {
        entityId,
        partKey,
        targetId: target ? target.targetId : null,
        targetPartKey: target ? target.targetPartKey : null
    });
}
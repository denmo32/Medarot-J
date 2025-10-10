/**
 * @file 行動決定ユーティリティ
 * このファイルは、aiSystemとinputSystemから共通して利用される、
 * プレイヤーやAIの行動選択を処理し、ゲームイベントを発行するためのユーティリティ関数を提供します。
 */
import { GameEvents } from '../common/events.js';
import { Parts } from '../core/components.js';
import { isValidTarget } from './queryUtils.js';

/**
 * 選択されたパーツに基づき、適切な行動決定イベントを発行します。
 * この関数は、aiSystemとinputSystemの重複ロジックを共通化するために作成されました。
 * パーツのアクションタイプ（格闘/射撃）を判別し、必要な検証を行った上で、
 * 適切なパラメータと共に `ACTION_SELECTED` イベントを発行します。
 * @param {World} world - ワールドオブジェクト
 * @param {number} entityId - 行動主体のエンティティID
 * @param {string} partKey - 選択されたパーツのキー
 * @param {{targetId: number, targetPartKey: string} | null} target - (射撃の場合) 事前に決定されたターゲット情報
 */
export function decideAndEmitAction(world, entityId, partKey, target = null) {
    const parts = world.getComponent(entityId, Parts);

    // ★追加: 選択されたパーツが無効、または破壊されている場合は行動を中断し、再選択を要求します。
    if (!parts || !parts[partKey] || parts[partKey].isBroken) {
        console.warn(`decideAndEmitAction: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
        world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
        return;
    }

    const selectedPartAction = parts[partKey].action;

    if (selectedPartAction === '格闘') {
        // 格闘の場合、ターゲットはActionSystemで移動後に決定されるため、ここではnullで発行します。
        world.emit(GameEvents.ACTION_SELECTED, { 
            entityId, 
            partKey, 
            targetId: null, 
            targetPartKey: null 
        });
    } else if (selectedPartAction === '援護') {
        // 援護行動（スキャン）の場合、ターゲットは設定しない（味方全体が対象）
        world.emit(GameEvents.ACTION_SELECTED, { 
            entityId, 
            partKey, 
            targetId: null, 
            targetPartKey: null 
        });
    } else { // '射撃'
        // 射撃の場合、有効なターゲットが必須です。ターゲットが無効な場合は再選択を要求します。
        if (!target || !isValidTarget(world, target.targetId, target.targetPartKey)) {
             console.warn(`decideAndEmitAction: Invalid or missing target for shooting action by ${entityId}. Re-queueing.`);
             world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
             return;
        }
        world.emit(GameEvents.ACTION_SELECTED, { 
            entityId, 
            partKey, 
            targetId: target.targetId, 
            targetPartKey: target.targetPartKey 
        });
    }
}

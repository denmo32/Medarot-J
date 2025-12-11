/**
 * @file 行動決定サービス
 * @description アクションの妥当性を検証し、イベントを発行する。
 * 元 scripts/battle/utils/actionUtils.js
 */
import { GameEvents } from '../../common/events.js';
import { Parts as CommonParts } from '../../components/index.js';
import { TargetingService } from './TargetingService.js';
import { TargetTiming } from '../../common/constants.js';

export class ActionService {
    /**
     * アクションを決定し、イベントを発行する
     * @param {World} world 
     * @param {number} entityId 
     * @param {string} partKey 
     * @param {object} target 
     */
    static decideAndEmit(world, entityId, partKey, target = null) {
        const parts = world.getComponent(entityId, CommonParts);

        if (!parts || !partKey || !parts[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionService: Invalid or broken part selected for entity ${entityId}. Re-queueing.`);
            world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const selectedPart = parts[partKey];

        // 単一ターゲットが必要な行動なのに、有効なターゲットが指定されていない場合に警告
        // PRE_MOVE（事前選択）の場合のみチェック
        if (selectedPart.targetTiming === TargetTiming.PRE_MOVE && selectedPart.targetScope?.endsWith('_SINGLE') && !TargetingService.isValidTarget(world, target?.targetId, target?.targetPartKey)) {
            console.error(`ActionService: A valid target was expected but not found. Action may fail.`, {entityId, partKey, target});
        }

        world.emit(GameEvents.ACTION_SELECTED, {
            entityId,
            partKey,
            targetId: target ? target.targetId : null,
            targetPartKey: target ? target.targetPartKey : null
        });
    }
}
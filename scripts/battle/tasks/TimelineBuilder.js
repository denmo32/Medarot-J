/**
 * @file TimelineBuilder.js
 */
import { 
    createWaitTask, createMoveTask, createAnimateTask, 
    createMessageTask, createApplyStateTask, createEventTask 
} from './BattleTasks.js';
import { GameEvents } from '../../common/events.js';
// scripts/battle/tasks/ -> ../common/constants.js
import { ModalType, ActionCancelReason, PlayerStateType } from '../common/constants.js';
import { MessageGenerator } from '../utils/MessageGenerator.js';
import { snapToActionLine, snapToHomePosition } from '../utils/positionUtils.js';
import { Position, GameState, ActiveEffects } from '../components/index.js';
import { PlayerInfo, Parts } from '../../components/index.js';
import { TeamID, EffectType } from '../../common/constants.js';
import { CONFIG } from '../../common/config.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
        this.messageGenerator = new MessageGenerator(world);
    }

    buildAttackSequence(resultData) {
        const tasks = [];
        const { attackerId, targetId, isSupport, isCancelled, cancelReason, outcome, appliedEffects, guardianInfo } = resultData;

        if (isCancelled) {
            tasks.push(createEventTask(GameEvents.ACTION_CANCELLED, { entityId: attackerId, reason: cancelReason }));
            const messageKey = this._getCancelMessageKey(cancelReason);
            const actorInfo = this.world.getComponent(attackerId, PlayerInfo);
            const message = this.messageGenerator.format(messageKey, { actorName: actorInfo?.name || '???' });
            
            tasks.push(createMessageTask(ModalType.MESSAGE, { message }, [{ text: message }]));
            tasks.push(createWaitTask(500));
            return tasks;
        }

        const declarationSeq = this.messageGenerator.createDeclarationSequence(resultData);
        tasks.push(createMessageTask(ModalType.ATTACK_DECLARATION, { ...resultData }, declarationSeq));
        
        if (targetId) {
            tasks.push(createAnimateTask(attackerId, targetId, 'attack'));
        } else {
            tasks.push(createAnimateTask(attackerId, attackerId, 'support'));
        }

        const resultSeq = this.messageGenerator.createResultSequence(resultData);
        
        // データ上のHP確定を行うタスク
        tasks.push(createApplyStateTask((world) => {
            if (appliedEffects) {
                appliedEffects.forEach(effect => {
                    // 1. データの更新
                    if (effect.type === EffectType.DAMAGE || effect.type === EffectType.HEAL) {
                        const parts = world.getComponent(effect.targetId, Parts);
                        if (parts && parts[effect.partKey]) {
                            const hpEvent = effect.events?.find(e => e.type === GameEvents.HP_UPDATED);
                            if (hpEvent) {
                                parts[effect.partKey].hp = hpEvent.payload.newHp;
                            }
                        }
                    }
                    
                    // 2. イベントの発行
                    if (effect.events) {
                        effect.events.forEach(e => world.emit(e.type, e.payload));
                    }
                });
            }
            
            world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, resultData);
        }));

        if (resultSeq.length > 0) {
            tasks.push(createMessageTask(ModalType.EXECUTION_RESULT, { ...resultData }, resultSeq));
        }

        tasks.push(createEventTask(GameEvents.REQUEST_COOLDOWN_TRANSITION, { entityId: attackerId }));
        
        return tasks;
    }

    _getCancelMessageKey(reason) {
        switch (reason) {
            case ActionCancelReason.PART_BROKEN: return 'CANCEL_PART_BROKEN';
            case ActionCancelReason.TARGET_LOST: return 'CANCEL_TARGET_LOST';
            case ActionCancelReason.INTERRUPTED: return 'CANCEL_INTERRUPTED';
            default: return 'CANCEL_INTERRUPTED';
        }
    }
}
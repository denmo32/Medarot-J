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
import { MessageKey } from '../../data/messageRepository.js';

export class TimelineBuilder {
    constructor(world) {
        this.world = world;
        this.messageGenerator = new MessageGenerator(world);
    }

    buildAttackSequence(resultData) {
        const tasks = [];
        const { attackerId, intendedTargetId, targetId, isSupport, isCancelled, cancelReason, outcome, appliedEffects, guardianInfo, summary } = resultData;

        if (isCancelled) {
            tasks.push(createEventTask(GameEvents.ACTION_CANCELLED, { entityId: attackerId, reason: cancelReason }));
            const messageKey = this._getCancelMessageKey(cancelReason);
            const actorInfo = this.world.getComponent(attackerId, PlayerInfo);
            const message = this.messageGenerator.format(messageKey, { actorName: actorInfo?.name || '???' });
            
            tasks.push(createMessageTask(ModalType.MESSAGE, { message }, [{ text: message }]));
            tasks.push(createWaitTask(500));
            return tasks;
        }

        // 1. ターゲットアニメーション（攻撃演出）
        const animationTargetId = intendedTargetId || targetId;
        if (animationTargetId) {
            tasks.push(createAnimateTask(attackerId, animationTargetId, 'attack'));
        } else {
            tasks.push(createAnimateTask(attackerId, attackerId, 'support'));
        }

        // 2. 行動結果適用 (データ更新 & HP_UPDATEDイベント発行)
        tasks.push(createApplyStateTask((world) => {
            if (appliedEffects) {
                appliedEffects.forEach(effect => {
                    // データの更新
                    if (effect.type === EffectType.DAMAGE || effect.type === EffectType.HEAL) {
                        const parts = world.getComponent(effect.targetId, Parts);
                        if (parts && parts[effect.partKey]) {
                            const hpEvent = effect.events?.find(e => e.type === GameEvents.HP_UPDATED);
                            if (hpEvent) {
                                parts[effect.partKey].hp = hpEvent.payload.newHp;
                            }
                        }
                    }
                    
                    // イベントの発行 (副作用: ガード消費によるクールダウンリクエスト等も含む)
                    if (effect.events) {
                        effect.events.forEach(e => world.emit(e.type, e.payload));
                    }
                });
            }
            
            world.emit(GameEvents.COMBAT_SEQUENCE_RESOLVED, resultData);
        }));

        // 3. 統合メッセージシーケンス（宣言 + 結果）
        const declarationSeq = this.messageGenerator.createDeclarationSequence(resultData);
        const resultSeq = this.messageGenerator.createResultSequence(resultData);
        const fullMessageSequence = [...declarationSeq, ...resultSeq];

        tasks.push(createMessageTask(ModalType.ATTACK_DECLARATION, { ...resultData }, fullMessageSequence));

        // 4. ガード回数終了メッセージ（Summaryフラグを使用）
        if (summary.isGuardExpired) {
            // 対象となるエンティティIDを特定（appliedEffectsから検索）
            const expiredEffect = appliedEffects.find(e => e.type === EffectType.CONSUME_GUARD && e.isExpired);
            if (expiredEffect) {
                const actorInfo = this.world.getComponent(expiredEffect.targetId, PlayerInfo);
                const message = this.messageGenerator.format(MessageKey.GUARD_EXPIRED, { actorName: actorInfo?.name || '???' });
                
                tasks.push(createMessageTask(ModalType.MESSAGE, { message }, [{ text: message }]));
            }
        }

        // クールダウンへの移行
        tasks.push(createEventTask(GameEvents.REQUEST_COOLDOWN_TRANSITION, { entityId: attackerId }));
        
        // 5. UIの最終整合性確保
        tasks.push(createEventTask(GameEvents.REFRESH_UI, {}));

        // 6. キャンセル状態チェック（ターゲットロストや予約パーツ破壊の確認）
        tasks.push(createEventTask(GameEvents.CHECK_ACTION_CANCELLATION, {}));

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
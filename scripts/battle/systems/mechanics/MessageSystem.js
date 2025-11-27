import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType, ActionCancelReason } from '../../common/constants.js';
import { MessageKey } from '../../../data/messageRepository.js';
import { PlayerInfo } from '../../../components/index.js';
import { MessageGenerator } from '../../utils/MessageGenerator.js';

const cancelReasonToMessageKey = {
    [ActionCancelReason.PART_BROKEN]: MessageKey.CANCEL_PART_BROKEN,
    [ActionCancelReason.TARGET_LOST]: MessageKey.CANCEL_TARGET_LOST,
    [ActionCancelReason.INTERRUPTED]: MessageKey.CANCEL_INTERRUPTED,
};

export class MessageSystem extends System {
    constructor(world) {
        super(world);
        this.messageGenerator = new MessageGenerator(world);
        
        this.on(GameEvents.REQUEST_RESULT_DISPLAY, this.onResultDisplayRequested.bind(this));
        this.on(GameEvents.ACTION_CANCELLED, this.onActionCancelled.bind(this));
        this.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    onResultDisplayRequested(detail) {
        const { resultData } = detail;
        if (!resultData || resultData.isCancelled) return;

        const { attackerId, targetId, appliedEffects } = resultData;
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return;

        // 攻撃宣言モーダルの表示
        const declarationSequence = this.messageGenerator.createDeclarationSequence(resultData);
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.ATTACK_DECLARATION,
            data: { ...resultData },
            messageSequence: declarationSequence,
            immediate: true,
        });

        const shouldShowResult = targetId || (appliedEffects && appliedEffects.length > 0);

        if (shouldShowResult) {
            // 結果表示モーダルの表示
            const resultSequence = this.messageGenerator.createResultSequence(resultData);
            
            if (resultSequence.length > 0) {
                this.world.emit(GameEvents.SHOW_MODAL, {
                    type: ModalType.EXECUTION_RESULT,
                    data: { ...resultData },
                    messageSequence: resultSequence,
                    immediate: true
                });
            }
        }
        
        // ActionPanelSystemがモーダルを閉じたタイミングで BattleSequenceSystem がフローを進める
    }

    onActionCancelled(detail) {
        const { entityId, reason } = detail;
        const actorInfo = this.world.getComponent(entityId, PlayerInfo);
        if (!actorInfo) return;

        const messageKey = cancelReasonToMessageKey[reason];
        if (!messageKey) return;
        
        const message = this.messageGenerator.format(messageKey, { actorName: actorInfo.name });
        
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }

    onGuardBroken(detail) {
        const message = this.messageGenerator.format(MessageKey.GUARD_BROKEN);
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: ModalType.MESSAGE,
            data: { message: message }
        });
    }
}
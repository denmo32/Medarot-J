import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo } from '../../../components/index.js';
import { ModalType } from '../../common/constants.js';
import { EffectScope } from '../../../common/constants.js';
import { getAllActionParts } from '../../utils/queryUtils.js';
import { decideAndEmitAction } from '../../utils/actionUtils.js';
import { AiDecisionService } from '../../services/AiDecisionService.js';

export class InputSystem extends System {
    constructor(world) {
        super(world);
        this.aiService = new AiDecisionService(world); // プレイヤーのオートターゲット補助等に使用
        this.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
        this.on(GameEvents.PART_SELECTED, this.onPartSelected.bind(this));
    }

    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        
        // AIサービスを利用して推奨ターゲット候補を取得
        const targetCandidates = this.aiService.getSuggestionForPlayer(entityId);
        
        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`Player ${entityId}: No valid target candidates found. Re-queueing.`);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        // 候補に基づきアクションプランを生成（ターゲット割り当て）
        const actionPlans = this.aiService.generateActionPlans(entityId, targetCandidates);
        const allPossibleParts = getAllActionParts(this.world, entityId);

        const buttonsData = allPossibleParts.map(([partKey, part]) => {
            const plan = actionPlans.find(p => p.partKey === partKey);
            let targetToSet = plan ? plan.target : null;

            if (part.targetScope === EffectScope.ALLY_TEAM || part.targetScope === EffectScope.SELF) {
                targetToSet = null;
            }

            return {
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action,
                target: targetToSet
            };
        });

        const panelData = {
            entityId: entityId,
            title: '',
            ownerName: playerInfo.name,
            buttons: buttonsData,
        };
        
        this.world.emit(GameEvents.SHOW_MODAL, { 
            type: ModalType.SELECTION, 
            data: panelData,
            immediate: true
        });
    }

    onPartSelected(detail) {
        const { entityId, partKey, target } = detail;
        decideAndEmitAction(this.world, entityId, partKey, target);
    }
}
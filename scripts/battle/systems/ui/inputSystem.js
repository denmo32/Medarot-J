import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo } from '../../components/index.js';
import { ModalType } from '../../../config/constants.js';
import { getAllActionParts } from '../../utils/queryUtils.js';
import { decideAndEmitAction } from '../../utils/actionUtils.js';
import { determineTargetCandidatesByPersonality } from '../../ai/aiDecisionUtils.js';
import { determineActionPlans } from '../../utils/targetingUtils.js';

export class InputSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
        this.on(GameEvents.PART_SELECTED, this.onPartSelected.bind(this));
    }

    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const context = { world: this.world, entityId };

        const { candidates: targetCandidates } = determineTargetCandidatesByPersonality(context);
        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`Player ${entityId}: No valid target candidates found. Re-queueing.`);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const actionPlans = determineActionPlans({ ...context, targetCandidates });
        if (actionPlans.length === 0) {
            console.warn(`Player ${entityId}: No attackable parts available.`);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const allPossibleParts = getAllActionParts(this.world, entityId);

        const buttonsData = allPossibleParts.map(([partKey, part]) => {
            const plan = actionPlans.find(p => p.partKey === partKey);
            return {
                text: `${part.name} (${part.type})`,
                partKey: partKey,
                isBroken: part.isBroken,
                action: part.action,
                target: plan ? plan.target : null
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
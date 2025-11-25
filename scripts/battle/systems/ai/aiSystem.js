import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { decideAndEmitAction } from '../../utils/actionUtils.js';
import { determineTargetCandidatesByPersonality, selectBestActionPlan } from '../../ai/aiDecisionUtils.js';
import { determineActionPlans } from '../../utils/targetingUtils.js';
import { ErrorHandler } from '../../../../engine/utils/ErrorHandler.js';

export class AiSystem extends System {
    constructor(world) {
        super(world);
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    onAiActionRequired(detail) {
        const { entityId } = detail;
        const context = { world: this.world, entityId };

        try {
            const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

            if (!targetCandidates || targetCandidates.length === 0) {
                console.warn(`AI ${entityId}: No target candidates found by personality.`);
                this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
                return;
            }

            const actionPlans = determineActionPlans({ ...context, targetCandidates });
            
            if (actionPlans.length === 0) {
                this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
                return;
            }

            const finalPlan = selectBestActionPlan({ ...context, actionPlans });

            if (!finalPlan) {
                console.error(`AI ${entityId}: Could not select a final action plan. Falling back to random.`);
                this._executeRandomFallback(entityId, actionPlans);
                return;
            }
            
            this._executePlan(entityId, finalPlan, usedStrategy);

        } catch (error) {
            ErrorHandler.handle(error, { method: 'AiSystem.onAiActionRequired', detail });
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
        }
    }

    _executePlan(entityId, plan, strategyKey) {
        if (strategyKey && plan.target) {
            this.world.emit(GameEvents.STRATEGY_EXECUTED, {
                strategy: strategyKey,
                attackerId: entityId,
                target: plan.target,
            });
        }
        decideAndEmitAction(this.world, entityId, plan.partKey, plan.target);
    }

    _executeRandomFallback(entityId, actionPlans) {
        if (actionPlans.length === 0) return;
        const randomPlan = actionPlans[Math.floor(Math.random() * actionPlans.length)];
        decideAndEmitAction(this.world, entityId, randomPlan.partKey, randomPlan.target);
    }
}
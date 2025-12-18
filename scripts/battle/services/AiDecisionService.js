/**
 * @file AiDecisionService.js
 * @description AIの意思決定ロジック。
 */
import { determineTargetCandidatesByPersonality, selectBestActionPlan } from '../ai/aiDecisionUtils.js';
import { ActionService } from './ActionService.js';
import { QueryService } from './QueryService.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
import { TargetTiming } from '../common/constants.js';
import { ActionRequeueState } from '../components/States.js';
import { StrategyExecutedEvent } from '../components/Requests.js';

export const AiDecisionService = {
    /**
     * 指定されたエンティティのAI思考を実行し、アクションリクエストを生成する
     * @param {World} world
     * @param {number} entityId 
     */
    processAiTurn(world, entityId) {
        const context = { world, entityId };

        const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`AI ${entityId}: No target candidates found by personality.`);
            this._requeue(world, entityId);
            return;
        }

        const actionPlans = this.generateActionPlans(world, entityId, targetCandidates);
        
        if (actionPlans.length === 0) {
             console.warn(`AI ${entityId}: No valid action plans.`);
             this._requeue(world, entityId);
            return;
        }

        const finalPlan = selectBestActionPlan({ ...context, actionPlans });

        if (!finalPlan) {
            console.error(`AI ${entityId}: Could not select a final action plan. Falling back to random.`);
            this._executeRandomFallback(world, entityId, actionPlans);
            return;
        }
        
        this._executePlan(world, entityId, finalPlan, usedStrategy);
    },

    getSuggestionForPlayer(world, entityId) {
        const context = { world, entityId };
        const { candidates } = determineTargetCandidatesByPersonality(context);
        return candidates || [];
    },

    generateActionPlans(world, entityId, targetCandidates) {
        if (!targetCandidates || targetCandidates.length === 0) {
            return [];
        }
        
        const availableParts = QueryService.getAttackableParts(world, entityId);
        if (availableParts.length === 0) {
            return [];
        }

        const actionPlans = [];
        for (const [partKey, part] of availableParts) {
            let selectedTarget = null;

            if (part.targetTiming === TargetTiming.PRE_MOVE) {
                const requiresSingleTarget = part.targetScope?.endsWith('_SINGLE');
                
                if (requiresSingleTarget) {
                    const selectedCandidate = selectItemByProbability(targetCandidates);
                    if (selectedCandidate) {
                        selectedTarget = selectedCandidate.target;
                    } else {
                        continue;
                    }
                }
            }
            
            actionPlans.push({
                partKey,
                part,
                target: selectedTarget,
            });
        }
        return actionPlans;
    },

    _executePlan(world, entityId, plan, strategyKey) {
        if (strategyKey && plan.target) {
            const debugEntity = world.createEntity();
            world.addComponent(debugEntity, new StrategyExecutedEvent(
                strategyKey,
                entityId,
                plan.target
            ));
        }
        ActionService.createActionRequest(world, entityId, plan.partKey, plan.target);
    },

    _executeRandomFallback(world, entityId, actionPlans) {
        if (actionPlans.length === 0) return;
        const randomPlan = actionPlans[Math.floor(Math.random() * actionPlans.length)];
        ActionService.createActionRequest(world, entityId, randomPlan.partKey, randomPlan.target);
    },

    _requeue(world, entityId) {
        const stateEntity = world.createEntity();
        const actionRequeueState = new ActionRequeueState();
        actionRequeueState.isActive = true;
        actionRequeueState.entityId = entityId;
        world.addComponent(stateEntity, actionRequeueState);
    }
};
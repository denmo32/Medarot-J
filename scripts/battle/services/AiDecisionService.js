/**
 * @file AiDecisionService.js
 * @description AIの意思決定ロジックを提供する純粋な関数群。
 * クラスインスタンス化を廃止し、ステートレスなロジックとして定義。
 */
import { determineTargetCandidatesByPersonality, selectBestActionPlan } from '../ai/aiDecisionUtils.js';
import { ActionService } from './ActionService.js';
import { QueryService } from './QueryService.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
import { TargetTiming } from '../common/constants.js';
import { ActionRequeueRequest } from '../components/index.js'; 
import { StrategyExecutedEvent } from '../components/Requests.js';

export const AiDecisionService = {
    /**
     * 指定されたエンティティのAI思考を実行し、アクションリクエストを生成する
     * @param {World} world
     * @param {number} entityId 
     */
    processAiTurn(world, entityId) {
        const context = { world, entityId };

        // 1. 性格に基づいてターゲット候補を選定
        const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`AI ${entityId}: No target candidates found by personality.`);
            const req = world.createEntity();
            world.addComponent(req, new ActionRequeueRequest(entityId));
            return;
        }

        // 2. 実行可能な行動プランを列挙
        const actionPlans = this.generateActionPlans(world, entityId, targetCandidates);
        
        if (actionPlans.length === 0) {
            // 有効なアクションがない場合
             console.warn(`AI ${entityId}: No valid action plans.`);
             const req = world.createEntity();
             world.addComponent(req, new ActionRequeueRequest(entityId));
            return;
        }

        // 3. 最適なプランを選択
        const finalPlan = selectBestActionPlan({ ...context, actionPlans });

        if (!finalPlan) {
            console.error(`AI ${entityId}: Could not select a final action plan. Falling back to random.`);
            this._executeRandomFallback(world, entityId, actionPlans);
            return;
        }
        
        // 4. プランを実行 (リクエスト生成)
        this._executePlan(world, entityId, finalPlan, usedStrategy);
    },

    /**
     * プレイヤーのターゲット選択補助のために、性格に基づいた候補を取得する
     * @param {World} world
     * @param {number} entityId 
     * @returns {object[]} ターゲット候補リスト
     */
    getSuggestionForPlayer(world, entityId) {
        const context = { world, entityId };
        const { candidates } = determineTargetCandidatesByPersonality(context);
        return candidates || [];
    },

    /**
     * ターゲット候補に基づき、実行可能なアクションプランを生成する
     * @param {World} world
     * @param {number} entityId 
     * @param {object[]} targetCandidates 
     * @returns {object[]}
     */
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
        // デバッグログ用イベントコンポーネントを生成
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
    }
};
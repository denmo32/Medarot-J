/**
 * @file AiDecisionService.js
 * @description AIの意思決定ロジックを提供するサービス。
 * 性格に基づくターゲット選定や、行動プランの評価・選択を行う。
 */
import { determineTargetCandidatesByPersonality, selectBestActionPlan } from '../ai/aiDecisionUtils.js';
import { GameEvents } from '../../common/events.js';
import { ActionService } from './ActionService.js';
import { QueryService } from './QueryService.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
import { TargetTiming as CommonTargetTiming } from '../../common/constants.js';

export class AiDecisionService {
    constructor(world) {
        this.world = world;
    }

    /**
     * 指定されたエンティティのAI思考を実行し、アクションを決定・発行する
     * @param {number} entityId 
     */
    processAiTurn(entityId) {
        const context = { world: this.world, entityId };

        // 1. 性格に基づいてターゲット候補を選定
        const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`AI ${entityId}: No target candidates found by personality.`);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        // 2. 実行可能な行動プランを列挙
        const actionPlans = this.generateActionPlans(entityId, targetCandidates);
        
        if (actionPlans.length === 0) {
            // 有効なアクションがない場合（全パーツ破壊など）
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
            return;
        }

        // 3. 最適なプランを選択
        const finalPlan = selectBestActionPlan({ ...context, actionPlans });

        if (!finalPlan) {
            console.error(`AI ${entityId}: Could not select a final action plan. Falling back to random.`);
            this._executeRandomFallback(entityId, actionPlans);
            return;
        }
        
        // 4. プランを実行
        this._executePlan(entityId, finalPlan, usedStrategy);
    }

    /**
     * プレイヤーのターゲット選択補助のために、性格に基づいた候補を取得する
     * @param {number} entityId 
     * @returns {object[]} ターゲット候補リスト
     */
    getSuggestionForPlayer(entityId) {
        const context = { world: this.world, entityId };
        const { candidates } = determineTargetCandidatesByPersonality(context);
        return candidates || [];
    }

    /**
     * ターゲット候補に基づき、実行可能なアクションプランを生成する
     * @param {number} entityId 
     * @param {object[]} targetCandidates 
     * @returns {object[]}
     */
    generateActionPlans(entityId, targetCandidates) {
        const context = { world: this.world, entityId };
        return this._determineActionPlans({ ...context, targetCandidates });
    }

    /**
     * 行動プラン生成ロジック (旧 targetingUtils.determineActionPlans)
     * @param {object} params { world, entityId, targetCandidates }
     * @returns {object[]}
     */
    _determineActionPlans({ world, entityId, targetCandidates }) {
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

            // 事前ターゲット選択（射撃など）の場合のみ、ここでターゲットを決定する
            if (part.targetTiming === CommonTargetTiming.PRE_MOVE) {
                // 単一ターゲットが必要な行動か判定
                const requiresSingleTarget = part.targetScope?.endsWith('_SINGLE');
                
                if (requiresSingleTarget) {
                    const selectedCandidate = selectItemByProbability(targetCandidates);
                    if (selectedCandidate) {
                        selectedTarget = selectedCandidate.target;
                    } else {
                        // 有効なターゲットがいない場合、このパーツでの行動はプランに追加しない
                        continue;
                    }
                }
                // 'ALLY_TEAM' のような単一ターゲット不要な行動は selectedTarget が null のまま進む
            }
            
            // 全ての有効なパーツについてプランを追加
            // POST_MOVE の場合、target は null になる
            actionPlans.push({
                partKey,
                part,
                target: selectedTarget,
            });
        }
        return actionPlans;
    }

    _executePlan(entityId, plan, strategyKey) {
        if (strategyKey && plan.target) {
            // デバッグやログ用に戦略情報を通知
            this.world.emit(GameEvents.STRATEGY_EXECUTED, {
                strategy: strategyKey,
                attackerId: entityId,
                target: plan.target,
            });
        }
        ActionService.decideAndEmit(this.world, entityId, plan.partKey, plan.target);
    }

    _executeRandomFallback(entityId, actionPlans) {
        if (actionPlans.length === 0) return;
        const randomPlan = actionPlans[Math.floor(Math.random() * actionPlans.length)];
        ActionService.decideAndEmit(this.world, entityId, randomPlan.partKey, randomPlan.target);
    }
}
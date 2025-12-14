/**
 * @file AiDecisionService.js
 * @description AIの意思決定ロジックを提供するサービス。
 * イベント発行をActionService.createActionRequestへの委譲に変更。
 */
import { determineTargetCandidatesByPersonality, selectBestActionPlan } from '../ai/aiDecisionUtils.js';
import { GameEvents } from '../../common/events.js';
import { ActionService } from './ActionService.js';
import { QueryService } from './QueryService.js';
import { selectItemByProbability } from '../../../engine/utils/MathUtils.js';
import { TargetTiming } from '../common/constants.js';
import { ActionRequeueRequest, SetPlayerBrokenRequest } from '../components/index.js'; // SetPlayerBrokenRequestはCommandRequestsかも

export class AiDecisionService {
    constructor(world) {
        this.world = world;
    }

    /**
     * 指定されたエンティティのAI思考を実行し、アクションリクエストを生成する
     * @param {number} entityId 
     */
    processAiTurn(entityId) {
        const context = { world: this.world, entityId };

        // 1. 性格に基づいてターゲット候補を選定
        const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`AI ${entityId}: No target candidates found by personality.`);
            const req = this.world.createEntity();
            this.world.addComponent(req, new ActionRequeueRequest(entityId));
            return;
        }

        // 2. 実行可能な行動プランを列挙
        const actionPlans = this.generateActionPlans(entityId, targetCandidates);
        
        if (actionPlans.length === 0) {
            // 有効なアクションがない場合（全パーツ破壊など） - CommandRequestを発行
            // Note: SetPlayerBrokenRequestのインポート元に注意
            const req = this.world.createEntity();
            // 仮: SetPlayerBrokenRequestを動的にインポートするか、引数で渡す設計が望ましいが、
            // ここでは単にActionServiceへ委譲できないため、イベントの代わりにコンポーネントを追加する
            // 便宜上、ActionServiceが処理できない "Broken" 状態は別途処理が必要だが、
            // ここではActionPlansが0になるケースは稀（機能停止判定は別途行われる）とする。
            // 万が一の場合はターンをスキップするリクエストなどを出す。
             console.warn(`AI ${entityId}: No valid action plans.`);
             this.world.addComponent(req, new ActionRequeueRequest(entityId));
            return;
        }

        // 3. 最適なプランを選択
        const finalPlan = selectBestActionPlan({ ...context, actionPlans });

        if (!finalPlan) {
            console.error(`AI ${entityId}: Could not select a final action plan. Falling back to random.`);
            this._executeRandomFallback(entityId, actionPlans);
            return;
        }
        
        // 4. プランを実行 (リクエスト生成)
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
    }

    _executePlan(entityId, plan, strategyKey) {
        // デバッグログ用イベントは維持（システムに影響しないため）
        if (strategyKey && plan.target) {
            this.world.emit(GameEvents.STRATEGY_EXECUTED, {
                strategy: strategyKey,
                attackerId: entityId,
                target: plan.target,
            });
        }
        ActionService.createActionRequest(this.world, entityId, plan.partKey, plan.target);
    }

    _executeRandomFallback(entityId, actionPlans) {
        if (actionPlans.length === 0) return;
        const randomPlan = actionPlans[Math.floor(Math.random() * actionPlans.length)];
        ActionService.createActionRequest(this.world, entityId, randomPlan.partKey, randomPlan.target);
    }
}
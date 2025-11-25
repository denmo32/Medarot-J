/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../../../engine/baseSystem.js';
import { GameEvents } from '../../../common/events.js';
import { decideAndEmitAction } from '../../utils/actionUtils.js';
import { determineTargetCandidatesByPersonality, selectBestActionPlan } from '../../ai/aiDecisionUtils.js';
import { determineActionPlans } from '../../utils/targetingUtils.js';
import { ErrorHandler } from '../../../engine/utils/ErrorHandler.js';

/**
 * AIの「脳」として機能するシステム。
 */
export class AiSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    /**
     * AIの行動選択が要求された際のハンドラ。AIの思考プロセスを開始します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;
        const context = { world: this.world, entityId };

        try {
            // --- Step 1: 性格に基づきターゲット候補リストを取得 ---
            const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

            if (!targetCandidates || targetCandidates.length === 0) {
                console.warn(`AI ${entityId}: No target candidates found by personality.`);
                // ターゲットが見つからない場合、再キューイングを要求して処理を終了
                this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
                return;
            }

            // --- Step 2: ターゲット候補と使用可能パーツから、行動プランのリストを生成 ---
            const actionPlans = determineActionPlans({ ...context, targetCandidates });
            
            if (actionPlans.length === 0) {
                // 使用可能なパーツがない場合（事実上の機能停止）
                this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
                return;
            }

            // --- Step 3: 行動プランの中から最適なものを一つ選択 ---
            const finalPlan = selectBestActionPlan({ ...context, actionPlans });

            if (!finalPlan) {
                console.error(`AI ${entityId}: Could not select a final action plan. Falling back to random.`);
                // 安全策としてランダム選択
                this._executeRandomFallback(entityId, actionPlans);
                return;
            }
            
            // --- Step 4: 決定した行動を実行 ---
            this._executePlan(entityId, finalPlan, usedStrategy);

        } catch (error) {
            ErrorHandler.handle(error, { method: 'AiSystem.onAiActionRequired', detail });
            // エラー時は進行を妨げないよう再キューイング
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
        }
    }

    /**
     * 決定された行動プランを実行（発行）します。
     * @private
     */
    _executePlan(entityId, plan, strategyKey) {
        if (strategyKey && plan.target) {
            // デバッグ用のイベント発行
            this.world.emit(GameEvents.STRATEGY_EXECUTED, {
                strategy: strategyKey,
                attackerId: entityId,
                target: plan.target,
            });
        }
        decideAndEmitAction(this.world, entityId, plan.partKey, plan.target);
    }

    /**
     * フォールバックとしてランダムな行動を実行します。
     * @private
     */
    _executeRandomFallback(entityId, actionPlans) {
        if (actionPlans.length === 0) return;
        const randomPlan = actionPlans[Math.floor(Math.random() * actionPlans.length)];
        decideAndEmitAction(this.world, entityId, randomPlan.partKey, randomPlan.target);
    }
}
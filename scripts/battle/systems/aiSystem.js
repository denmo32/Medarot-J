/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Medal, PlayerInfo } from '../core/components/index.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTargetCandidatesByPersonality } from '../ai/aiDecisionUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
import { partSelectionStrategies } from '../ai/partSelectionStrategies.js';
import { determineActionPlans } from '../utils/targetingUtils.js';

/**
 * AIの「脳」として機能するシステム。
 * TurnSystemからAIの行動ターンであることが通知されると、このシステムが起動します。
 * プレイヤーの入力を待つInputSystemと対になる存在であり、AIの意思決定プロセスを担います。
 */
export class AiSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    /**
     * AIの行動選択が要求された際のハンドラ。AIの思考プロセスを開始します。
     * 人間と同じ「ターゲット候補リスト→行動プラン→パーツ選択」のフローで意思決定を行います。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;
        const context = { world: this.world, entityId };

        // --- Step 1: 性格に基づきターゲット候補リストを取得 ---
        const { candidates: targetCandidates, strategy: usedStrategy } = determineTargetCandidatesByPersonality(context);

        if (!targetCandidates || targetCandidates.length === 0) {
            console.warn(`AI ${entityId}: No target candidates found by personality. Action will be cancelled.`);
            // 行動を決定せず、選択キューに再登録を要求して他のAIの選択を待つ
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        // --- Step 2: ターゲット候補と使用可能パーツから、行動プランのリストを生成 ---
        const actionPlans = determineActionPlans({ ...context, targetCandidates });
        
        if (actionPlans.length === 0) {
            // 使用可能なパーツがない場合は機能停止
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
            return;
        }

        // --- Step 3: 行動プランの中から最適なものを一つ選択 ---
        const finalPlan = this.selectBestActionPlan(entityId, actionPlans);

        if (!finalPlan) {
            console.error(`AI ${entityId}: Could not select a final action plan. This should not happen.`);
            // フェイルセーフとしてランダムなプランを選択
            const randomPlan = actionPlans[Math.floor(Math.random() * actionPlans.length)];
            decideAndEmitAction(this.world, entityId, randomPlan.partKey, randomPlan.target);
            return;
        }
        
        // --- Step 4: デバッグイベントを発行し、最終決定した行動を発行 ---
        if (usedStrategy && finalPlan.target) {
            this.world.emit(GameEvents.STRATEGY_EXECUTED, {
                strategy: usedStrategy,
                attackerId: entityId,
                target: finalPlan.target,
            });
        }
        decideAndEmitAction(this.world, entityId, finalPlan.partKey, finalPlan.target);
    }

    /**
     * 与えられた行動プランのリストから、AIの性格に基づいて最適なプランを1つ選択します。
     * @param {number} entityId - AIのエンティティID
     * @param {Array<object>} actionPlans - 評価対象の行動プランリスト
     * @returns {object | null} 最適と判断された行動プラン
     */
    selectBestActionPlan(entityId, actionPlans) {
        const attackerMedal = this.world.getComponent(entityId, Medal);
        const strategies = getStrategiesFor(attackerMedal.personality);
        const attackerInfo = this.world.getComponent(entityId, PlayerInfo);
        let partStrategyKey;

        // 1. どのパーツ選択戦略を使うか決定する
        const preMovePlan = actionPlans.find(plan => plan.target !== null);

        if (preMovePlan) {
            // pre-moveプランがあれば、そのターゲット情報を基に戦略を決定
            const targetInfo = this.world.getComponent(preMovePlan.target.targetId, PlayerInfo);
            if (targetInfo && attackerInfo.teamId === targetInfo.teamId) {
                partStrategyKey = strategies.partStrategyMap.ally;
            } else {
                partStrategyKey = strategies.partStrategyMap.enemy;
            }
        } else {
            // pre-moveプランがない場合（全てpost-move）、アクションの性質から戦略を決定
            if (actionPlans.length > 0) {
                const representativePart = actionPlans[0].part;
                // targetScopeが'ALLY'で始まるかどうかで、味方対象か敵対象かを判断
                if (representativePart.targetScope?.startsWith('ALLY')) {
                    partStrategyKey = strategies.partStrategyMap.ally;
                } else {
                    // 敵対象、または自分自身を対象とするもの（SELF_GUARDなど）はenemy戦略を使用
                    partStrategyKey = strategies.partStrategyMap.enemy;
                }
            }
        }

        if (!partStrategyKey) {
            console.warn(`AI ${entityId} (${attackerMedal.personality}): No part strategy found for the target type. Falling back.`);
            return actionPlans[Math.floor(Math.random() * actionPlans.length)];
        }

        // 2. パーツ選択戦略を実行して最適なパーツを決定する
        const partSelectionFunc = partSelectionStrategies[partStrategyKey];
        if (!partSelectionFunc) {
            console.error(`AI ${entityId}: Part strategy '${partStrategyKey}' not found. Falling back.`);
            return actionPlans[Math.floor(Math.random() * actionPlans.length)];
        }
        
        // パーツ選択戦略は `[partKey, part]` の形式の配列を期待するため、プランから変換する
        const availablePartsForStrategy = actionPlans.map(plan => [plan.partKey, plan.part]);
        const [bestPartKey] = partSelectionFunc({ world: this.world, entityId, availableParts: availablePartsForStrategy });

        // 3. 最適なパーツキーに対応する行動プランを返す
        return actionPlans.find(plan => plan.partKey === bestPartKey) || null;
    }
}
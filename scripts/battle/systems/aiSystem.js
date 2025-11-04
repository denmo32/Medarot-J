/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Medal, Parts, PlayerInfo } from '../core/components/index.js';
import { getAttackableParts, getValidEnemies, getValidAllies, isValidTarget, findMostDamagedAllyPart, getCandidatesByScope } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget, determineTargetByPersonality } from '../utils/targetingUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
import { partSelectionStrategies } from '../ai/partSelectionStrategies.js';
import { targetingStrategies } from '../ai/targetingStrategies.js';
import { conditionEvaluators } from '../ai/conditionEvaluators.js';
import { EffectScope } from '../common/constants.js';

// AiSystem内に直接定義されていた conditionEvaluators は conditionEvaluators.js に移管

/**
 * AIの「脳」として機能するシステム。
 * TurnSystemからAIの行動ターンであることが通知されると、このシステムが起動します。
 * プレイヤーの入力を待つInputSystemと対になる存在であり、AIの意思決定プロセスを担います。
 */
export class AiSystem extends BaseSystem {
    constructor(world) {
        super(world);

        // AIの行動が必要になった時（AIのターンが来た時）のイベントのみを購読します。
        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    /**
     * TurnSystemからAIの行動選択が要求された際のハンドラ。AIの思考プロセスを開始します。
     * ターゲット決定ロジックを修正し、パーツ選択との連携を改善します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;

        const availableParts = getAttackableParts(this.world, entityId);
        if (availableParts.length === 0) {
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
            return;
        }

        const attackerMedal = this.world.getComponent(entityId, Medal);
        const strategies = getStrategiesFor(attackerMedal.personality);
        const context = { world: this.world, entityId, availableParts };

        let selectedPartKey = null;
        let finalTarget = null;

        // --- Step 1: ターゲットを決定 ---
        const { target, strategyKey: usedStrategyKey } = determineTargetByPersonality(context);
        finalTarget = target;

        // --- Step 2: ターゲットが決まった場合、それに最適なパーツを選択 ---
        if (finalTarget) {
            // 思考ルーチンの中から、使用されたターゲット戦略に一致するものを探す
            const matchingRoutine = strategies.routines.find(routine => routine.targetStrategy === usedStrategyKey);
            
            if (matchingRoutine) {
                const { partStrategy } = matchingRoutine;
                let partSelectionFunc;
                if (typeof partStrategy === 'string') {
                    partSelectionFunc = partSelectionStrategies[partStrategy];
                } else if (typeof partStrategy === 'object' && partStrategy.type) {
                    const baseStrategy = partSelectionStrategies[partStrategy.type];
                    if (baseStrategy) partSelectionFunc = baseStrategy(partStrategy.params);
                }

                if (partSelectionFunc) {
                    const [partKey] = partSelectionFunc(context);
                    if (partKey) {
                        selectedPartKey = partKey;
                    }
                }
            }
        }

        // --- Step 3: フォールバック処理 ---
        // ターゲットが見つからない、または最適なパーツが見つからない場合
        if (!finalTarget || !selectedPartKey) {
            console.warn(`AI ${entityId} (${attackerMedal.personality}) could not decide action. Using full fallback.`);
            
            // ランダムなパーツを選択
            const [partKey] = partSelectionStrategies.RANDOM(context);
            selectedPartKey = partKey;
            
            // フォールバック用のターゲットを再決定（ターゲットがまだ決まっていない場合のみ）
            if (!finalTarget) {
                const fallbackKey = Object.keys(targetingStrategies).find(key => targetingStrategies[key] === strategies.fallbackTargeting);
                finalTarget = determineTarget(this.world, entityId, strategies.fallbackTargeting, fallbackKey);
            }
        }
        
        // --- Step 4: 最終決定した行動を発行 ---
        decideAndEmitAction(this.world, entityId, selectedPartKey, finalTarget);
    }
}
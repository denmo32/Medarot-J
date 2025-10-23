/**
 * @file AI思考システム
 * このファイルは、AIキャラクターの行動と思考ロジックを管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameEvents } from '../common/events.js';
import { Medal, Parts, PlayerInfo } from '../core/components/index.js';
import { getAttackableParts, getValidEnemies, getValidAllies, isValidTarget, findMostDamagedAllyPart, getCandidatesByScope } from '../utils/queryUtils.js';
import { decideAndEmitAction } from '../utils/actionUtils.js';
import { determineTarget } from '../utils/targetingUtils.js';
import { getStrategiesFor } from '../ai/personalityRegistry.js';
import { partSelectionStrategies } from '../ai/partSelectionStrategies.js';
import { targetingStrategies } from '../ai/targetingStrategies.js';
import { EffectScope } from '../common/constants.js';


/**
 * AI思考ルーチンの実行条件を評価する関数のコレクション。
 * personalityRegistry`で定義された`condition`データオブジェクトを解釈します。
 * @type {Object.<string, function({world: World, entityId: number, params: object}): boolean>}
 */
const conditionEvaluators = {
    /**
     * 味方（自分を含む/含まない）の誰かがダメージを受けているかを評価します。
     * @param {object} context - 評価コンテキスト
     * @returns {boolean} - ダメージを受けている味方がいればtrue
     */
    ANY_ALLY_DAMAGED: ({ world, entityId, params }) => {
        const { includeSelf = false } = params || {};
        const allies = getValidAllies(world, entityId, includeSelf);
        // 最もダメージを受けた味方パーツが存在するかどうかで判断
        return findMostDamagedAllyPart(world, allies) !== null;
    },
    // 将来的な条件を追加する例:
    // IS_LEADER: ({ world, entityId }) => world.getComponent(entityId, PlayerInfo)?.isLeader,
};

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
     * AIの意思決定を宣言的な「思考ルーチン」ベースに刷新。
     * 1. 性格レジストリから、その性格に定義された「思考ルーチン」のリストを取得します。
     * 2. リストを優先順位の高い順（配列の先頭から）にループ処理します。
     * 3. 各ルーチンで定義された「パーツ戦略」と「ターゲット戦略」を実行します。
     * 4. 有効なパーツとターゲットの組み合わせが見つかった時点で、その行動を決定し、思考を終了します。
     * 5. 全てのルーチンを試しても行動が決まらない場合、最終的なフォールバック戦略（通常はランダム攻撃）を実行します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     */
    onAiActionRequired(detail) {
        const { entityId } = detail;

        const availableParts = getAttackableParts(this.world, entityId);
        if (availableParts.length === 0) {
            // 攻撃可能なパーツがない場合は機能停止と見なす
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
            return;
        }

        const attackerMedal = this.world.getComponent(entityId, Medal);
        const strategies = getStrategiesFor(attackerMedal.personality);
        const context = { world: this.world, entityId, availableParts };

        let selectedPartKey = null;
        let finalTarget = null;

        // --- Step 1: 思考ルーチンを順番に試行 ---
        if (strategies.routines && strategies.routines.length > 0) {
            for (const routine of strategies.routines) {
                // ルーチンに実行条件(condition)が定義されていれば評価する
                if (routine.condition) {
                    const evaluator = conditionEvaluators[routine.condition.type];
                    if (evaluator) {
                        // 条件を満たさなければ、このルーチンはスキップして次へ
                        if (!evaluator({ ...context, params: routine.condition.params })) {
                            continue;
                        }
                    } else {
                        console.warn(`AiSystem: Unknown condition type '${routine.condition.type}' for ${attackerMedal.personality}.`);
                        continue;
                    }
                }

                const { partStrategy, targetStrategy: targetStrategyKey } = routine;
                
                let partSelectionFunc;
                if (typeof partStrategy === 'object' && partStrategy.type) {
                    const baseStrategy = partSelectionStrategies[partStrategy.type];
                    if (baseStrategy) {
                        partSelectionFunc = baseStrategy(partStrategy.params);
                    }
                } else if (typeof partStrategy === 'string') {
                    partSelectionFunc = partSelectionStrategies[partStrategy];
                }

                if (!partSelectionFunc) {
                    console.warn(`AiSystem: Unknown or invalid partStrategy in routines for ${attackerMedal.personality}.`, partStrategy);
                    continue;
                }
                
                const [partKey, part] = partSelectionFunc(context);
                if (!partKey) continue; 

                // ターゲット候補リストの作成を削除。各戦略が自身で候補を決定します。
                
                const targetSelectionFunc = targetingStrategies[targetStrategyKey];
                if (!targetSelectionFunc) {
                    console.warn(`AiSystem: Unknown targetStrategy '${targetStrategyKey}' in routines for ${attackerMedal.personality}.`);
                    continue;
                }
                
                // 候補リスト(candidates)を渡さずにターゲットを決定
                const target = determineTarget(this.world, entityId, targetSelectionFunc, targetStrategyKey);

                if (target) {
                    selectedPartKey = partKey;
                    finalTarget = target;
                    break; 
                }
            }
        }

        // --- Step 2: ルーチンで行動が決まらなかった場合の最終フォールバック ---
        if (!finalTarget) {
            console.warn(`AI ${entityId} (${attackerMedal.personality}) could not decide action via routines. Using fallback targeting.`);
            
            const [partKey] = partSelectionStrategies.RANDOM(context);
            
            if (partKey) {
                selectedPartKey = partKey;
                const fallbackKey = Object.keys(targetingStrategies).find(key => targetingStrategies[key] === strategies.fallbackTargeting);
                // 候補リスト(candidates)を渡さずにターゲットを決定
                finalTarget = determineTarget(this.world, entityId, strategies.fallbackTargeting, fallbackKey);
            }
        }
        
        // --- Step 3: 最終決定した行動を発行 ---
        decideAndEmitAction(this.world, entityId, selectedPartKey, finalTarget);
    }
}
/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションの実行フローを管理する責務を持ちます。
 * 具体的には、状態遷移、アニメーション要求、効果計算、UI表示要求といった一連の処理を統括します。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action, ActiveEffects } from '../core/components/index.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
import { PlayerStateType, ModalType, GamePhaseType, PartInfo, PartKeyToInfoMap, EffectType, ActionType, TargetTiming } from '../common/constants.js';
import { findBestDefensePart, findNearestEnemy, selectRandomPart, getValidAllies, findGuardian } from '../utils/queryUtils.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { BaseSystem } from '../../core/baseSystem.js';
import { ErrorHandler, GameError, ErrorType } from '../utils/errorHandler.js';
import { effectStrategies } from '../effects/effectStrategies.js';
import { postMoveTargetingStrategies } from '../ai/postMoveTargetingStrategies.js';

/**
 * 「行動の実行フロー」に特化したシステム。
 * 状態遷移、アニメーション要求、後続システムへの処理委譲を行います。
 * 実際の戦闘結果判定や効果適用は、それぞれ専門のシステムが担当します。
 */
export class ActionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // Use new context components
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);
        this.isPaused = false;  // ゲームの一時停止状態を管理
        
        // UIの応答を待つための状態を保持
        this.pendingActionData = null;
        
        // イベント購読
        this.world.on(GameEvents.COMBAT_OUTCOME_RESOLVED, this.onCombatOutcomeResolved.bind(this));
        // UIモーダルの完了イベントを購読
        this.world.on(GameEvents.MODAL_SEQUENCE_COMPLETED, this.onModalSequenceCompleted.bind(this));
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    /**
     * 毎フレーム実行され、「行動実行準備完了」状態のエンティティを探して処理します。
     */
    update(deltaTime) {
        try {
            // isPaused または pendingActionData が存在する場合(UI応答待ち)は、新たなアクションを開始しない
            if (this.isPaused || this.pendingActionData) return;
            
            const entitiesWithState = this.world.getEntitiesWith(GameState);
            const executor = entitiesWithState.find(id => 
                this.getCachedComponent(id, GameState)?.state === PlayerStateType.READY_EXECUTE
            );
            
            if (executor === undefined || executor === null) return;
            
            const action = this.getCachedComponent(executor, Action);
            const gameState = this.getCachedComponent(executor, GameState);
            if (!action || !gameState) return;

            this._determinePostMoveTarget(executor);
            
            gameState.state = PlayerStateType.AWAITING_ANIMATION;
            this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
                attackerId: executor,
                targetId: action.targetId
            });
        } catch (error) {
            ErrorHandler.handle(error, { method: 'update', deltaTime, executor: executor || 'N/A' });
        }
    }
    
    /**
     * 移動後にターゲットを決定するアクションのターゲットを解決します。
     * @param {number} executorId - 行動を実行するエンティティのID
     * @private
     */
    _determinePostMoveTarget(executorId) {
        const action = this.getCachedComponent(executorId, Action);
        const parts = this.getCachedComponent(executorId, Parts);
        if (!action || !parts) return;

        const selectedPart = parts[action.partKey];
        if (!selectedPart) return;

        if (selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
            const strategyKey = selectedPart.postMoveTargeting;
            const strategy = postMoveTargetingStrategies[strategyKey];

            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId: executorId });
                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                } else {
                    console.warn(`ActionSystem: Post-move strategy '${strategyKey}' found no target for ${executorId}.`);
                }
            } else if (strategyKey) {
                console.error(`ActionSystem: Unknown post-move strategy '${strategyKey}' for part '${selectedPart.name}'.`);
            }
        }
    }

    /**
     * 戦闘結果の判定が完了した際に呼び出されます。
     * @param {object} detail - COMBAT_OUTCOME_RESOLVED イベントのペイロード
     */
    onCombatOutcomeResolved(detail) {
        try {
            const { attackerId, attackingPart, attackerInfo, attackerParts, outcome, finalTargetId, finalTargetPartKey, guardianInfo } = detail;

            const resolvedEffects = [];
            if (outcome.isHit || !finalTargetId) {
                if (attackingPart.effects && Array.isArray(attackingPart.effects)) {
                    for (const effect of attackingPart.effects) {
                        if (Math.random() >= (effect.chance || 1.0)) continue;
                        
                        const strategy = effectStrategies[effect.type];
                        if (strategy) {
                            const effectContext = {
                                world: this.world,
                                sourceId: attackerId,
                                targetId: finalTargetId,
                                effect: effect,
                                part: attackingPart,
                                partKey: this.world.getComponent(attackerId, Action).partKey,
                                partOwner: { info: attackerInfo, parts: attackerParts },
                                outcome: { ...outcome, finalTargetPartKey },
                            };
                            const result = strategy(effectContext);
                            if (result) {
                                result.penetrates = attackingPart.penetrates || false;
                                resolvedEffects.push(result);
                            }
                        }
                    }
                }
            }
            
            // UIの応答を待つため、後続処理に必要なデータを`pendingActionData`に保存
            this.pendingActionData = {
                attackerId: attackerId,
                targetId: finalTargetId,
                resolvedEffects: resolvedEffects,
                isEvaded: !outcome.isHit,
                isSupport: attackingPart.isSupport,
                guardianInfo: guardianInfo,
            };

            // UI表示のためのイベントを発行
            this.world.emit(GameEvents.ACTION_DECLARED, {
                attackerId: attackerId,
                targetId: finalTargetId,
                attackingPart: attackingPart,
                isSupport: attackingPart.isSupport,
                guardianInfo: guardianInfo,
            });

        } catch (error) {
            ErrorHandler.handle(error, { method: 'onCombatOutcomeResolved', detail });
        }
    }

    /**
     * UIモーダルの表示が完了した際に呼び出されるハンドラ。
     * UIの応答を待ち状態だったゲームフローを再開します。
     * @param {object} detail - MODAL_SEQUENCE_COMPLETED イベントのペイロード
     */
    onModalSequenceCompleted(detail) {
        const { modalType, originalData } = detail;
        
        // 1. 攻撃宣言モーダルが完了した場合
        if (modalType === ModalType.ATTACK_DECLARATION && this.pendingActionData) {
            // 保存していたデータを使って、効果適用イベントを発行
            this.world.emit(GameEvents.ATTACK_DECLARATION_CONFIRMED, this.pendingActionData);
            // 待機状態を解除
            this.pendingActionData = null;
        
            // ゲームオーバー判定
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) {
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: originalData.attackerId });
            }
        }
        // 2. 実行結果モーダルが完了した場合
        else if (modalType === ModalType.EXECUTION_RESULT) {
            // 攻撃シーケンスの完了を通知
            this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: originalData.attackerId });
        }
    }


    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}
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
        
        // イベント購読
        // 戦闘結果の判定が完了したら、このシステムが効果の計算（解決）を行います。
        this.world.on(GameEvents.COMBAT_OUTCOME_RESOLVED, this.onCombatOutcomeResolved.bind(this));
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    /**
     * 毎フレーム実行され、「行動実行準備完了」状態のエンティティを探して処理します。
     */
    update(deltaTime) {
        try {
            if (this.isPaused) return;
            
            const entitiesWithState = this.world.getEntitiesWith(GameState);
            const executor = entitiesWithState.find(id => 
                this.getCachedComponent(id, GameState)?.state === PlayerStateType.READY_EXECUTE
            );
            
            if (executor === undefined || executor === null) return;
            
            const action = this.getCachedComponent(executor, Action);
            const gameState = this.getCachedComponent(executor, GameState);
            if (!action || !gameState) return;

            // 移動後ターゲット決定ロジックをプライベートメソッドに委譲
            this._determinePostMoveTarget(executor);
            
            // 状態をアニメーション待ちに変更し、アニメーションの実行を要求します。
            // この後の処理は、アニメーション完了後にイベント駆動でCombatResolutionSystemが開始します。
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
     * updateメソッドの責務を明確化するためにロジックを分離しました。
     * @param {number} executorId - 行動を実行するエンティティのID
     * @private
     */
    _determinePostMoveTarget(executorId) {
        const action = this.getCachedComponent(executorId, Action);
        const parts = this.getCachedComponent(executorId, Parts);
        if (!action || !parts) return;

        const selectedPart = parts[action.partKey];
        if (!selectedPart) return;

        // パーツにマージされた `targetTiming` を直接参照し、ターゲットが未定の場合のみ処理
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
                // パーツに戦略が定義されているのに、実装が見つからない場合
                console.error(`ActionSystem: Unknown post-move strategy '${strategyKey}' for part '${selectedPart.name}'.`);
            }
        }
    }

    /**
     * CombatResolutionSystemによる戦闘結果の判定が完了した際に呼び出されます。
     * このシステムの責務は、判定結果に基づいて「どのような効果が発生するか」を計算（解決）し、
     * UI表示と効果適用のためにイベントを発行することです。
     * @param {object} detail - COMBAT_OUTCOME_RESOLVED イベントのペイロード
     */
    onCombatOutcomeResolved(detail) {
        try {
            const {
                attackerId,
                finalTargetId,
                finalTargetPartKey,
                attackingPart,
                attackerInfo,
                attackerParts,
                outcome,
                guardianInfo,
            } = detail;

            // 手順1: パーツに定義された効果を解決(resolve)します。
            const resolvedEffects = [];
            // 命中したか、ターゲットがいないアクション（援護など）の場合のみ効果を解決します。
            if (outcome.isHit || !finalTargetId) {
                if (attackingPart.effects && Array.isArray(attackingPart.effects)) {
                    for (const effect of attackingPart.effects) {
                        // 確率(chance)に基づいた発動判定
                        if (Math.random() >= (effect.chance || 1.0)) {
                            continue; // 確率判定に失敗した場合はこの効果をスキップ
                        }
                        
                        const strategy = effectStrategies[effect.type];
                        if (strategy) {
                            // effectStrategiesに渡すコンテキストを構築
                            const effectContext = {
                                world: this.world,
                                sourceId: attackerId,
                                targetId: finalTargetId,
                                effect: effect,
                                part: attackingPart,
                                partKey: this.world.getComponent(attackerId, Action).partKey, // 使用パーツのキー
                                partOwner: { info: attackerInfo, parts: attackerParts },
                                outcome: { ...outcome, finalTargetPartKey }, // 命中結果と最終ターゲット情報を渡す
                            };
                            const result = strategy(effectContext);
                            if (result) {
                                // 使用パーツの貫通属性を効果結果に付与する
                                result.penetrates = attackingPart.penetrates || false;
                                resolvedEffects.push(result);
                            }
                        }
                    }
                }
            }
            
            // 手順2: UI表示のためのイベントを発行します。
            const isSupportAction = attackingPart.isSupport;
            this.world.emit(GameEvents.ACTION_DECLARED, {
                attackerId: attackerId,
                targetId: finalTargetId, // 最終的なターゲットIDを渡す
                attackingPart: attackingPart,
                isSupport: isSupportAction,
                guardianInfo: guardianInfo,
                // 他のシステムがモーダル確認後に利用するデータをペイロードに含める
                resolvedEffects: resolvedEffects,
                isEvaded: !outcome.isHit,
            });

            // リーダーが破壊されゲームオーバーになった場合、後続の処理をスキップ
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) {
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: attackerId });
            }

        } catch (error) {
            ErrorHandler.handle(error, { method: 'onCombatOutcomeResolved', detail });
        }
    }

    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}
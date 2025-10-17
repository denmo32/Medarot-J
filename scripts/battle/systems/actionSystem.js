/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action, ActiveEffects } from '../core/components/index.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
// ★改善: PartInfo, PartKeyToInfoMapを参照し、定義元を一元化
// ★修正: ActionType, TargetTiming をインポート
import { PlayerStateType, ModalType, GamePhaseType, PartInfo, PartKeyToInfoMap, EffectType, ActionType, TargetTiming } from '../common/constants.js';
// ★修正: findGuardian をインポートし、findMostDamagedAllyPartを削除
import { findBestDefensePart, findNearestEnemy, selectRandomPart, getValidAllies, findGuardian } from '../utils/queryUtils.js';
// ★修正: combatFormulasからCombatCalculatorをインポート
import { CombatCalculator } from '../utils/combatFormulas.js';
import { BaseSystem } from '../../core/baseSystem.js';
import { ErrorHandler, GameError, ErrorType } from '../utils/errorHandler.js';
// ★新規: アクション効果の戦略をインポート
import { effectStrategies } from '../effects/effectStrategies.js';
// ★新規: 移動後ターゲット決定戦略をインポート
import { postMoveTargetingStrategies } from '../ai/postMoveTargetingStrategies.js';

/**
 * 「行動の実行」に特化したシステム。
 * なぜこのシステムが必要か？
 * StateSystemがエンティティを「行動実行準備完了」状態にした後、このシステムがバトンを受け取ります。
 * ダメージ計算、命中判定、結果のUI表示、最終的な結果の適用、といった一連の処理は複雑です。
 * これらを状態管理から分離することで、それぞれのロジックをシンプルに保ち、見通しを良くしています。
 */
export class ActionSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // Use new context components
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);
        this.isPaused = false;  // ゲームの一時停止状態を管理
        
        // イベント購読
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    /**
     * ★廃止: このイベントの購読と処理は EffectApplicatorSystem に移管されました。
     * このシステムはモーダルが閉じられたことを直接知る必要がなくなりました。
     */
    // onAttackDeclarationConfirmed(detail) { ... }

    /**
     * ★廃止: このメソッドの責務はonAttackDeclarationConfirmedに統合されました。
     */
    // onActionExecutionConfirmed(detail) { ... }

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
            const parts = this.getCachedComponent(executor, Parts); // ★追加
            if (!action || !gameState || !parts) return;
            
            const selectedPart = parts[action.partKey];
            if (!selectedPart) return;

            // ★リファクタリング: パーツにマージされた `targetTiming` を直接参照する
            if (selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
                const strategyKey = selectedPart.postMoveTargeting;
                const strategy = postMoveTargetingStrategies[strategyKey];

                if (strategy) {
                    const targetData = strategy({ world: this.world, attackerId: executor });
                    if (targetData) {
                        action.targetId = targetData.targetId;
                        action.targetPartKey = targetData.targetPartKey;
                    } else {
                        console.warn(`ActionSystem: Post-move strategy '${strategyKey}' found no target for ${executor}.`);
                    }
                } else if (strategyKey) {
                    // パーツに戦略が定義されているのに、実装が見つからない場合
                    console.error(`ActionSystem: Unknown post-move strategy '${strategyKey}' for part '${selectedPart.name}'.`);
                }
            }

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
     * ViewSystemでの実行アニメーションが完了した際に呼び出されます。
     * 攻撃の命中判定、ダメージ計算、結果のUI表示要求までの一連の処理を統括します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onExecutionAnimationCompleted(detail) {
        try {
            const { entityId: executor } = detail;

            // 手順1: 攻撃に必要なコンポーネント群をまとめて取得します。
            const components = this._getCombatComponents(executor);
            if (!components) {
                console.warn(`ActionSystem: Missing required components for attack calculation involving executor: ${executor}`);
                this.world.emit(GameEvents.EFFECTS_RESOLVED, { attackerId: executor, resolvedEffects: [], isEvaded: false, isSupport: false, guardianInfo: null });
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            let { action, attackerInfo, attackerParts, targetInfo, targetParts } = components;
            
            const attackingPart = attackerParts[action.partKey];
            let targetLegs = targetParts ? targetParts.legs : null;

            // 手順2: ガード役を索敵し、必要であればターゲットを更新します。
            let guardian = null;
            // ★リファクタリング: isSupportやactionTypeをパーツオブジェクトから直接参照
            const isSingleDamageAction = !attackingPart.isSupport && [ActionType.SHOOT, ActionType.MELEE].includes(attackingPart.actionType) && action.targetId !== null;

            if (isSingleDamageAction) {
                // ★修正: ガード役の索敵ロジックを queryUtils の findGuardian に移譲
                guardian = findGuardian(this.world, action.targetId);
                if (guardian) {
                    // ターゲットをガード役に上書き
                    action.targetId = guardian.id;
                    action.targetPartKey = guardian.partKey;
                    // 上書き後のターゲット情報を再取得
                    targetParts = this.getCachedComponent(guardian.id, Parts);
                    targetLegs = targetParts ? targetParts.legs : null;
                }
            }

            // 手順3: 攻撃の命中結果（回避、クリティカル、防御）を決定します。
            // ★リファクタリング: 複雑な命中判定ロジックを CombatCalculator に移譲
            const outcome = CombatCalculator.resolveHitOutcome({
                world: this.world,
                attackerId: executor,
                targetId: action.targetId,
                attackingPart: attackingPart,
                targetLegs: targetLegs,
                initialTargetPartKey: action.targetPartKey
            });

            // 手順4: パーツに定義された効果を解決(resolve)します。
            const resolvedEffects = [];
            // 命中したか、ターゲットがいないアクション（援護など）の場合のみ効果を解決します。
            if (outcome.isHit || !action.targetId) {
                if (attackingPart.effects && Array.isArray(attackingPart.effects)) {
                    for (const effect of attackingPart.effects) {
                        // ★新規: 確率(chance)に基づいた発動判定
                        if (Math.random() >= (effect.chance || 1.0)) {
                            continue; // 確率判定に失敗した場合はこの効果をスキップ
                        }
                        
                        const strategy = effectStrategies[effect.type];
                        if (strategy) {
                            // ★修正: effectStrategiesにpartKeyを渡す
                            const effectContext = {
                                world: this.world,
                                sourceId: executor,
                                targetId: action.targetId,
                                effect: effect,
                                part: attackingPart,
                                partKey: action.partKey, // ガード効果などで使用
                                partOwner: { info: attackerInfo, parts: attackerParts },
                                outcome: outcome, // 計算済みの命中結果を渡す
                            };
                            const result = strategy(effectContext);
                            if (result) {
                                // ★新規: 使用パーツの貫通属性を効果結果に付与する
                                result.penetrates = attackingPart.penetrates || false;
                                resolvedEffects.push(result);
                            }
                        }
                    }
                }
            }
            
            const isSupportAction = attackingPart.isSupport;
            
            // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
            // ★修正: イベント発行順序を変更。モーダル表示を先に行い、UIのポーズ状態を確定させてから効果解決イベントを発行する。
            
            // 手順5: 攻撃宣言モーダルを表示し、計算結果をUI層に伝達します。
            let declarationMessage;
            if (isSupportAction) {
                 declarationMessage = `${attackerInfo.name}の${attackingPart.action}行動！ ${attackingPart.trait}！`;
            } else if (!action.targetId) {
                declarationMessage = `${attackerInfo.name}の攻撃は空を切った！`;
            } else {
                declarationMessage = `${attackerInfo.name}の${attackingPart.type}攻撃！ ${attackingPart.trait}！`;
            }

            this.world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.ATTACK_DECLARATION,
                data: {
                    entityId: executor,
                    message: declarationMessage,
                    isEvaded: !outcome.isHit,
                    isSupport: isSupportAction,
                    resolvedEffects: resolvedEffects,
                    guardianInfo: guardian,
                },
                immediate: true
            });

            // 手順6: 効果の「解決」が完了したことを、他のシステムに通知します。
            const resolvedPayload = {
                attackerId: executor,
                resolvedEffects: resolvedEffects,
                isEvaded: !outcome.isHit,
                isSupport: isSupportAction,
                guardianInfo: guardian,
            };
            this.world.emit(GameEvents.EFFECTS_RESOLVED, resolvedPayload);
            // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---


            // リーダーが破壊されゲームオーバーになった場合、後続の処理をスキップ
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) {
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }

        } catch (error) {
            ErrorHandler.handle(error, { method: 'onExecutionAnimationCompleted', detail });
        }
    }
    
    /**
     * @private
     * 攻撃の実行に必要なコンポーネント群をまとめて取得します。
     * @param {number} executorId - 攻撃者のエンティティID
     * @returns {object|null} 必要なコンポーネントをまとめたオブジェクト、または取得に失敗した場合null
     */
    _getCombatComponents(executorId) {
        const action = this.getCachedComponent(executorId, Action);
        if (!action) return null;

        const attackerInfo = this.getCachedComponent(executorId, PlayerInfo);
        const attackerParts = this.getCachedComponent(executorId, Parts);
        if (!attackerInfo || !attackerParts) {
            return null;
        }

        // ターゲットが存在する場合のみ、ターゲットのコンポーネントを取得
        if (this.isValidEntity(action.targetId)) {
            const targetInfo = this.getCachedComponent(action.targetId, PlayerInfo);
            const targetParts = this.getCachedComponent(action.targetId, Parts);
            if (!targetInfo) {
                return { action, attackerInfo, attackerParts, targetInfo: null, targetParts: null };
            }
            return { action, attackerInfo, attackerParts, targetInfo, targetParts };
        }

        // ターゲットがいない場合（援護、格闘の空振りなど）
        return { action, attackerInfo, attackerParts, targetInfo: null, targetParts: null };
    }

    /**
     * @private
     * ★廃止: このメソッドの責務は `utils/combatFormulas.js` の `CombatCalculator` に移管されました。
     */
    // _resolveHitOutcome(attackingPart, targetLegs, targetId, initialTargetPartKey, executorId) { ... }
    
    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}
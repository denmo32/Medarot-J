/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action } from '../core/components.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
// ★改善: PartInfo, PartKeyToInfoMapを参照し、定義元を一元化
import { PlayerStateType, ModalType, GamePhaseType, PartInfo, PartKeyToInfoMap, EffectType } from '../common/constants.js';
import { findBestDefensePart, findNearestEnemy, selectRandomPart } from '../utils/queryUtils.js';
import { calculateEvasionChance, calculateDefenseChance, calculateCriticalChance } from '../utils/combatFormulas.js';
import { BaseSystem } from '../../core/baseSystem.js';
import { ErrorHandler, GameError, ErrorType } from '../utils/errorHandler.js';
// ★新規: アクション効果の戦略をインポート
import { effectStrategies } from '../effects/effectStrategies.js';

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
        this.world.on(GameEvents.ATTACK_DECLARATION_CONFIRMED, this.onAttackDeclarationConfirmed.bind(this));
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    /**
     * ★新規: 攻撃宣言モーダルが確認された際に呼び出されます。
     * @param {object} detail - イベント詳細
     */
    onAttackDeclarationConfirmed(detail) {
        try {
            // ★変更: ペイロードから resolvedEffects を受け取る
            const { entityId, resolvedEffects, isEvaded, isSupport } = detail;

            // パラメータの検証
            if (typeof entityId !== 'number') {
                throw new GameError(
                    `Invalid parameters in attack declaration confirmation: entityId=${entityId}`,
                    ErrorType.VALIDATION_ERROR,
                    { detail, method: 'onAttackDeclarationConfirmed' }
                );
            }

            // ★変更: resolvedEffects を含んだ新しいペイロードで ACTION_EXECUTED を発行
            this.world.emit(GameEvents.ACTION_EXECUTED, {
                attackerId: entityId,
                resolvedEffects: resolvedEffects || [], // 効果がなくても空配列を渡す
                isEvaded: isEvaded || false,
                isSupport: isSupport || false,
            });

            // ゲームオーバーチェック
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) {
                return;
            }

        } catch (error) {
            ErrorHandler.handle(error, { method: 'onAttackDeclarationConfirmed', detail });
        }
    }


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
            if (!action || !gameState) return;
            
            if (action.properties.targetTiming === 'post-move' && action.targetId === null) {
                const nearestEnemyId = findNearestEnemy(this.world, executor);
                if (nearestEnemyId !== null) {
                    const targetData = selectRandomPart(this.world, nearestEnemyId);
                    if (targetData) {
                        action.targetId = targetData.targetId;
                        action.targetPartKey = targetData.targetPartKey;
                    } else {
                        console.warn(`ActionSystem: No valid parts to attack on nearest enemy ${nearestEnemyId}.`);
                        gameState.state = PlayerStateType.AWAITING_ANIMATION;
                        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
                            attackerId: executor,
                            targetId: null
                        });
                        return;
                    }
                } else {
                    console.warn(`ActionSystem: No valid enemies for melee attack by ${executor}.`);
                    gameState.state = PlayerStateType.AWAITING_ANIMATION;
                    this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
                        attackerId: executor,
                        targetId: null
                    });
                    return;
                }
            } else {
                gameState.state = PlayerStateType.AWAITING_ANIMATION;
                this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
                    attackerId: executor,
                    targetId: action.targetId
                });
            }
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
                this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, resolvedEffects: [] });
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            const { action, attackerInfo, attackerParts, targetInfo, targetParts } = components;
            
            // ★★★ ここからが新しいロジック ★★★
            const attackingPart = attackerParts[action.partKey];
            const targetLegs = targetParts ? targetParts.legs : null;

            // 手順2: 攻撃の命中結果（回避、クリティカル、防御）を決定します。
            const outcome = this._resolveHitOutcome(attackingPart, targetLegs, action.targetId, action.targetPartKey, executor);

            // 手順3: パーツに定義された効果を解決(resolve)する
            const resolvedEffects = [];
            // 命中したか、ターゲットがいないアクション（援護など）の場合のみ効果を解決
            if (outcome.isHit || !action.targetId) {
                if (attackingPart.effects && Array.isArray(attackingPart.effects)) {
                    for (const effect of attackingPart.effects) {
                        const strategy = effectStrategies[effect.strategy];
                        if (strategy) {
                            const effectContext = {
                                world: this.world,
                                sourceId: executor,
                                targetId: action.targetId,
                                effect: effect,
                                part: attackingPart,
                                partOwner: { info: attackerInfo, parts: attackerParts },
                                outcome: outcome,
                            };
                            const result = strategy(effectContext);
                            if (result) {
                                resolvedEffects.push(result);
                            }
                        }
                    }
                }
            }

            // 手順4: 攻撃宣言モーダルを表示し、計算結果をUI層に伝達します。
            const primaryEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE) || resolvedEffects[0] || {};
            const isSupportAction = attackingPart.action === '援護';
            
            let declarationMessage;
            if (isSupportAction) {
                declarationMessage = `${attackerInfo.name}の${attackingPart.type}行動！ ${attackingPart.trait}！`;
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
                    resolvedEffects: resolvedEffects, // ★変更: 計算された効果のリストを渡す
                },
                immediate: true
            });
            // ★★★ ここまで ★★★

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
            // ★修正: ターゲットのパーツが見つからない場合も許容する
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
     * 攻撃の命中結果（回避、クリティカル、防御）を判定します。
     * @param {object} attackingPart - 攻撃側のパーツ
     * @param {object | null} targetLegs - ターゲットの脚部パーツ (nullの場合あり)
     * @param {number | null} targetId - ターゲットのエンティID (nullの場合あり)
     * @param {string} initialTargetPartKey - 当初のターゲットパーツキー
     * @param {number} executorId - 実行者のエンティティID
     * @returns {{isHit: boolean, isCritical: boolean, isDefended: boolean, finalTargetPartKey: string}} 命中結果オブジェクト
     */
    _resolveHitOutcome(attackingPart, targetLegs, targetId, initialTargetPartKey, executorId) {
        // 援護行動は必ず「命中」する
        if (attackingPart.action === '援護') {
            return { isHit: true, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // ターゲットがいない（空振り）場合は命中しない
        if (!targetId || !targetLegs) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // ★修正: calculateEvasionChance に world と attackerId を渡す
        const evasionChance = calculateEvasionChance(this.world, executorId, targetLegs.mobility, attackingPart.success);
        if (Math.random() < evasionChance) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        let isCritical = false;
        let isDefended = false;
        let finalTargetPartKey = initialTargetPartKey;

        const critChance = calculateCriticalChance(attackingPart, targetLegs);
        isCritical = Math.random() < critChance;

        if (!isCritical) {
            const defenseChance = calculateDefenseChance(targetLegs.armor);
            if (Math.random() < defenseChance) {
                const defensePartKey = findBestDefensePart(this.world, targetId);
                if (defensePartKey) {
                    isDefended = true;
                    finalTargetPartKey = defensePartKey;
                }
            }
        }

        return { isHit: true, isCritical, isDefended, finalTargetPartKey };
    }

    /**
     * @private
     * ★廃止: スキャン効果の適用は effectStrategies に移管されました。
     */
    // _applyScanBonus(attackingPart, targetId, executorId) { ... }
    
    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}
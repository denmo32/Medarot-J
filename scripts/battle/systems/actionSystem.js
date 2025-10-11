/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action } from '../core/components.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
// ★改善: PartInfo, PartKeyToInfoMapを参照し、定義元を一元化
import { PlayerStateType, ModalType, GamePhaseType, PartInfo, PartKeyToInfoMap } from '../common/constants.js';
import { findBestDefensePart, findNearestEnemy, selectRandomPart } from '../utils/queryUtils.js';
import { calculateDamage, calculateEvasionChance, calculateDefenseChance, calculateCriticalChance } from '../utils/combatFormulas.js';
import { BaseSystem } from '../../core/baseSystem.js';
import { ErrorHandler, GameError, ErrorType } from '../utils/errorHandler.js';

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
     * @param {object} detail - イベント詳細 ({ entityId, damage, resultMessage, targetId, targetPartKey, isCritical, isDefended })
     */
    onAttackDeclarationConfirmed(detail) {
        try {
            const { entityId, damage, targetId, targetPartKey, isCritical, isDefended, isEvaded, isSupport } = detail;

            // パラメータの検証
            if (typeof entityId !== 'number') { // damageの検証は不要な場合がある
                throw new GameError(
                    `Invalid parameters in attack declaration confirmation: entityId=${entityId}`,
                    ErrorType.VALIDATION_ERROR,
                    { detail, method: 'onAttackDeclarationConfirmed' }
                );
            }
            
            // ★★★ ここから修正 ★★★

            // isSupport または !targetId (空振り) の場合、専用のイベントを発行して終了
            if (isSupport || !targetId) {
                this.world.emit(GameEvents.ACTION_EXECUTED, {
                    attackerId: entityId,
                    targetId: null,
                    targetPartKey: null,
                    damage: 0, 
                    isPartBroken: false, 
                    isPlayerBroken: false,
                    isCritical: false, 
                    isDefended: false, 
                    isEvaded: false,
                    isSupport: isSupport || false,
                });
                return;
            }

            // ★★★ ここまで修正 ★★★

            // 以下はターゲットが存在する通常の攻撃の場合の処理
            const targetParts = this.getCachedComponent(targetId, Parts);
            if (!targetParts || !targetParts[targetPartKey]) {
                 throw new GameError(
                    `Target part not found: ${targetPartKey} for entityId: ${targetId}`,
                    ErrorType.COMPONENT_ERROR,
                    { targetId, targetPartKey, method: 'onAttackDeclarationConfirmed' }
                );
            }

            const targetPart = targetParts[targetPartKey];
            const newHp = Math.max(0, targetPart.hp - (damage || 0));
            
            const isPartBroken = newHp === 0 && !targetPart.isBroken;
            const isPlayerBroken = targetPartKey === PartInfo.HEAD.key && newHp === 0;

            this.world.emit(GameEvents.ACTION_EXECUTED, {
                attackerId: entityId,
                targetId: targetId,
                targetPartKey: targetPartKey,
                damage: damage || 0,
                isPartBroken: isPartBroken,
                isPlayerBroken: isPlayerBroken,
                isCritical: isCritical || false,
                isDefended: isDefended || false,
                isEvaded: isEvaded || false,
                isSupport: false, // この分岐では常にfalse
            });

            // ゲームオーバーチェック
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) { // Use BattlePhaseContext
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
                this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, damage: 0, targetId: null });
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            const { action, attackerInfo, targetInfo, attackerParts, targetParts } = components;
            
            // ★★★ ここからが復元された重要ロジック ★★★
            const attackingPart = attackerParts[action.partKey];
            const attackerLegs = attackerParts.legs;
            
            // ターゲットがいない場合（空振り）でも targetLegs は null になる
            const targetLegs = targetParts ? targetParts.legs : null;

            // 手順2: 攻撃の命中結果（回避、クリティカル、防御）を決定します。
            const outcome = this._resolveHitOutcome(attackingPart, targetLegs, action.targetId, action.targetPartKey, executor);

            // 手順3: 命中結果とアクションタイプに基づいて最終的なダメージを計算します。
            const isSupportAction = attackingPart.action === '援護';
            const finalDamage = isSupportAction || !outcome.isHit || !targetLegs
                ? 0 // 支援、回避、ターゲットなし(空振り)の場合はダメージ0
                : calculateDamage(
                    attackingPart,
                    attackerLegs,
                    targetLegs,
                    outcome.isCritical,
                    !outcome.isCritical && !outcome.isDefended // isDefenseBypassed
                );

            // 手順4: 結果をActionコンポーネントに一時保存します（防御によるターゲット変更などを反映）。
            action.targetPartKey = outcome.finalTargetPartKey;

            // 手順5: 攻撃宣言モーダルを表示し、計算結果をUI層に伝達します。
            let declarationMessage;
            if (isSupportAction) {
                declarationMessage = `${attackerInfo.name}の支援行動！　スキャン！`;
            } else if (!action.targetId) {
                declarationMessage = `${attackerInfo.name}の攻撃は空を切った！`;
            }
            else {
                declarationMessage = `${attackerInfo.name}の${attackingPart.type}攻撃！　${attackingPart.trait}！`;
            }
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.ATTACK_DECLARATION,
                data: {
                    entityId: executor,
                    message: declarationMessage,
                    damage: finalDamage,
                    targetId: action.targetId,
                    targetPartKey: outcome.finalTargetPartKey,
                    isCritical: outcome.isCritical,
                    isDefended: outcome.isDefended,
                    isEvaded: !outcome.isHit,
                    isSupport: isSupportAction
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
            if (!targetInfo || !targetParts) {
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
        if (attackingPart.action === '援護') {
            this._applyScanBonus(attackingPart, targetId, executorId);
            return { isHit: true, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // ターゲットがいない（空振り）場合は命中しない
        if (!targetId || !targetLegs) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

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
     * スキャンパーツの効果を適用する
     * @param {object} attackingPart - 攻撃側のパーツ
     * @param {number} targetId - ターゲットのエンティティID（支援行動では使用しないが引数として受け取る）
     * @param {number} executorId - 実行者のエンティティID
     */
    _applyScanBonus(attackingPart, targetId, executorId) {
        const scanBonusValue = Math.floor(attackingPart.might / 10);

        const attackerInfo = this.getCachedComponent(executorId, PlayerInfo);
        if (attackerInfo) {
            const entities = this.world.getEntitiesWith(PlayerInfo);
            entities.forEach(id => {
                const playerInfo = this.getCachedComponent(id, PlayerInfo);
                if (playerInfo && playerInfo.teamId === attackerInfo.teamId) {
                    playerInfo.scanBonus = scanBonusValue;
                }
            });
        }
    }
    
    onPauseGame() {
        this.isPaused = true;
    }
    
    onResumeGame() {
        this.isPaused = false;
    }
}

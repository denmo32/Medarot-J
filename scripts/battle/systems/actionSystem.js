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
        // ★変更: イベント購読を更新
        this.world.on(GameEvents.ATTACK_DECLARATION_CONFIRMED, this.onAttackDeclarationConfirmed.bind(this));
        // ViewSystemからのアニメーション完了通知を購読します。
        this.world.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onExecutionAnimationCompleted.bind(this));
    }

    /**
     * ★新規: 攻撃宣言モーダルが確認された際に呼び出されます。
     * @param {object} detail - イベント詳細 ({ entityId, damage, resultMessage, targetId, targetPartKey, isCritical, isDefended })
     */
    onAttackDeclarationConfirmed(detail) {
        try {
            // ★修正: ペイロードから全情報を取得
            const { entityId, damage, resultMessage, targetId, targetPartKey, isCritical, isDefended } = detail;

            // パラメータの検証
            if (typeof entityId !== 'number' || typeof damage !== 'number' || typeof resultMessage !== 'string') {
                throw new GameError(
                    `Invalid parameters in attack declaration confirmation: entityId=${entityId}, damage=${damage}, resultMessage=${resultMessage}`,
                    ErrorType.VALIDATION_ERROR,
                    { detail, method: 'onAttackDeclarationConfirmed' }
                );
            }

            // 格闘攻撃が空振りした場合など、ターゲットが存在しない場合はシーケンスを完了させる
            if (!targetId) {
                // ACTION_EXECUTEDに空振り情報を詰めて発行
                this.world.emit(GameEvents.ACTION_EXECUTED, {
                    attackerId: entityId,
                    targetId: null,
                    targetPartKey: null,
                    damage: 0,
                    isPartBroken: false,
                    isPlayerBroken: false,
                    resultMessage: '攻撃は空を切った！',
                    isCritical: false,
                    isDefended: false,
                });
                // 空振りでもシーケンス完了イベントを発行
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId });
                return;
            }

            const targetParts = this.getCachedComponent(targetId, Parts);
            if (!targetParts) {
                throw new GameError(
                    `Target parts not found for entityId: ${targetId}`,
                    ErrorType.COMPONENT_ERROR,
                    { targetId, method: 'onAttackDeclarationConfirmed' }
                );
            }

            if (!targetParts[targetPartKey]) {
                throw new GameError(
                    `Target part not found: ${targetPartKey} for entityId: ${targetId}`,
                    ErrorType.COMPONENT_ERROR,
                    { targetId, targetPartKey, method: 'onAttackDeclarationConfirmed' }
                );
            }

            const targetPart = targetParts[targetPartKey];
            const newHp = Math.max(0, targetPart.hp - damage);
            
            const isPartBroken = newHp === 0 && !targetPart.isBroken;
            const isPlayerBroken = targetPartKey === PartInfo.HEAD.key && newHp === 0;

            // 1. ゲームロジックを確定させるイベントを発行 (UI表示用の情報もペイロードに含める)
            this.world.emit(GameEvents.ACTION_EXECUTED, {
                attackerId: entityId,
                targetId: targetId,
                targetPartKey: targetPartKey,
                damage: damage,
                isPartBroken: isPartBroken,
                isPlayerBroken: isPlayerBroken,
                resultMessage: resultMessage,
                isCritical: isCritical,
                isDefended: isDefended,
            });

            // ゲームオーバーチェック
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) { // Use BattlePhaseContext
                return;
            }

            // 2. ★削除: UIに結果を表示するためのモーダル表示要求はActionPanelSystemに移管
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
            if (this.uiStateContext.isPausedByModal) return; // Use UIStateContext
            
            const entitiesWithState = this.world.getEntitiesWith(GameState);
            const executor = entitiesWithState.find(id => 
                this.getCachedComponent(id, GameState)?.state === PlayerStateType.READY_EXECUTE
            );
            
            if (executor === undefined || executor === null) return;
            
            const action = this.getCachedComponent(executor, Action);
            const gameState = this.getCachedComponent(executor, GameState);
            if (!action || !gameState) return;
            
            // ★改善: アクションのプロパティに基づき、実行直前にターゲットを決定する
            if (action.properties.targetTiming === 'post-move' && action.targetId === null) {
                const nearestEnemyId = findNearestEnemy(this.world, executor);
                if (nearestEnemyId !== null) {
                    // 最も近い敵にターゲットを設定
                    const targetData = selectRandomPart(this.world, nearestEnemyId);
                    if (targetData) {
                        action.targetId = targetData.targetId;
                        action.targetPartKey = targetData.targetPartKey;
                    } else {
                        // ターゲットはいるが、攻撃可能なパーツがない場合
                        console.warn(`ActionSystem: No valid parts to attack on nearest enemy ${nearestEnemyId}.`);
                        // ★暫定対応: 行動をスキップしてクールダウンに戻す
                        this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, damage: 0 });
                        return;
                    }
                } else {
                    // 有効な敵がいない場合
                    console.warn(`ActionSystem: No valid enemies for melee attack by ${executor}.`);
                    // ★暫定対応: 行動をスキップしてクールダウンに戻す
                    this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, damage: 0 });
                    return;
                }
            }
            
            // ★改善: アニメーション要求フローを簡略化。RenderSystemに直接アニメーションを要求する。
            // これにより、ViewSystemの仲介が不要になり、システム間の連携がシンプルになる。
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
                // ターゲットがいない（格闘の空振りなど）場合、攻撃シーケンスを完了させる
                this.world.emit(GameEvents.ACTION_EXECUTED, { attackerId: executor, damage: 0, resultMessage: '攻撃は空を切った！' });
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            const { action, attackerInfo, targetInfo, attackerParts, targetParts } = components;
            const attackingPart = attackerParts[action.partKey];
            const attackerLegs = attackerParts.legs;
            const targetLegs = targetParts.legs;

            // 手順2: 攻撃の命中結果（回避、クリティカル、防御）を決定します。
            const outcome = this._resolveHitOutcome(attackingPart, targetLegs, action.targetId, action.targetPartKey);

            // 手順3: 命中結果に基づいて最終的なダメージを計算します。
            const finalDamage = outcome.isHit
                ? calculateDamage(
                    attackingPart,
                    attackerLegs,
                    targetLegs,
                    outcome.isCritical,
                    !outcome.isCritical && !outcome.isDefended // isDefenseBypassed
                )
                : 0;

            // 手順4: 結果に基づいたUIメッセージを生成します。
            const resultMessage = this._generateResultMessage(targetInfo, outcome, finalDamage);

            // 手順5: 結果をActionコンポーネントに一時保存します（防御によるターゲット変更などを反映）。
            action.targetPartKey = outcome.finalTargetPartKey;

            // 手順6: 攻撃宣言モーダルを表示し、計算結果をUI層に伝達します。
            const declarationMessage = `${attackerInfo.name}の${attackingPart.type}攻撃！　${attackingPart.trait}！`;
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.ATTACK_DECLARATION,
                data: {
                    entityId: executor,
                    message: declarationMessage,
                    damage: finalDamage,
                    resultMessage: resultMessage,
                    targetId: action.targetId,
                    targetPartKey: outcome.finalTargetPartKey,
                    isCritical: outcome.isCritical,
                    isDefended: outcome.isDefended,
                },
                immediate: true
            });

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
        if (!action || !this.isValidEntity(action.targetId)) return null;

        const attackerInfo = this.getCachedComponent(executorId, PlayerInfo);
        const targetInfo = this.getCachedComponent(action.targetId, PlayerInfo);
        const attackerParts = this.getCachedComponent(executorId, Parts);
        const targetParts = this.getCachedComponent(action.targetId, Parts);

        if (!attackerInfo || !targetInfo || !attackerParts || !targetParts) {
            return null;
        }
        return { action, attackerInfo, targetInfo, attackerParts, targetParts };
    }

    /**
     * @private
     * 攻撃の命中結果（回避、クリティカル、防御）を判定します。
     * @param {object} attackingPart - 攻撃側のパーツ
     * @param {object} targetLegs - ターゲットの脚部パーツ
     * @param {number} targetId - ターゲットのエンティティID
     * @param {string} initialTargetPartKey - 当初のターゲットパーツキー
     * @returns {{isHit: boolean, isCritical: boolean, isDefended: boolean, finalTargetPartKey: string}} 命中結果オブジェクト
     */
    _resolveHitOutcome(attackingPart, targetLegs, targetId, initialTargetPartKey) {
        // 1. 回避判定
        const evasionChance = calculateEvasionChance(targetLegs.mobility, attackingPart.success);
        if (Math.random() < evasionChance) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // 命中確定
        let isCritical = false;
        let isDefended = false;
        let finalTargetPartKey = initialTargetPartKey;

        // 2. クリティカル判定
        const critChance = calculateCriticalChance(attackingPart, targetLegs);
        isCritical = Math.random() < critChance;

        if (!isCritical) {
            // 3. 防御判定 (クリティカルでない場合のみ)
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
     * 攻撃結果に基づいてUIに表示するメッセージを生成します。
     * @param {PlayerInfo} targetInfo - ターゲットのPlayerInfoコンポーネント
     * @param {object} outcome - _resolveHitOutcomeからの命中結果
     * @param {number} finalDamage - 最終ダメージ
     * @returns {string} 生成された結果メッセージ
     */
    _generateResultMessage(targetInfo, outcome, finalDamage) {
        if (!outcome.isHit) {
            return `${targetInfo.name}は攻撃を回避！`;
        }

        const finalTargetPartName = PartKeyToInfoMap[outcome.finalTargetPartKey]?.name || '不明な部位';
        let message = '';

        if (outcome.isCritical) {
            message = 'クリティカル！　';
        }

        if (outcome.isDefended) {
            message = `${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
        } else {
            message += `${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
        }

        return message;
    }
}
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
     * @param {object} detail - イベント詳細 ({ entityId, damage, resultMessage, targetId, targetPartKey })
     */
    onAttackDeclarationConfirmed(detail) {
        try {
            // ★修正: ペイロードから全情報を取得
            const { entityId, damage, resultMessage, targetId, targetPartKey } = detail;

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

            // 1. ゲームロジックを確定させるイベントを発行
            this.world.emit(GameEvents.ACTION_EXECUTED, {
                attackerId: entityId,
                targetId: targetId,
                targetPartKey: targetPartKey,
                damage: damage,
                isPartBroken: isPartBroken,
                isPlayerBroken: isPlayerBroken,
            });

            // ゲームオーバーチェック
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) { // Use BattlePhaseContext
                return;
            }

            // 2. UIに結果を表示するためのモーダル表示を要求
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.EXECUTION_RESULT,
                data: {
                    entityId: entityId,
                    message: resultMessage,
                    targetId: targetId,
                    targetPartKey: targetPartKey,
                    damage: damage
                },
                immediate: true
            });
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
            
            // ★追加: 格闘攻撃の場合、実行直前にターゲットを決定する
            if (action.type === '格闘' && action.targetId === null) {
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
     * ダメージ計算や命中判定を行い、結果をモーダルで表示するよう要求します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onExecutionAnimationCompleted(detail) {
        try {
            const { entityId: executor } = detail;
            const action = this.getCachedComponent(executor, Action);
            if (!action) {
                console.warn(`ActionSystem: No action component found for executor: ${executor}`);
                return;
            }
            
            const attackerInfo = this.getCachedComponent(executor, PlayerInfo);
            const targetInfo = this.getCachedComponent(action.targetId, PlayerInfo);
            const attackerParts = this.getCachedComponent(executor, Parts);
            const targetParts = this.getCachedComponent(action.targetId, Parts);
            if (!attackerInfo || !targetInfo || !attackerParts || !targetParts) {
                console.warn(`ActionSystem: Missing required components for attack calculation between ${executor} and ${action.targetId}`);
                return;
            }
            
            const attackingPart = attackerParts[action.partKey];
            const targetLegs = targetParts.legs;
            
            // パーツデータの検証
            if (!attackingPart) {
                throw new GameError(
                    `Attacking part not found: ${action.partKey} for entityId: ${executor}`,
                    ErrorType.COMPONENT_ERROR,
                    { executor, partKey: action.partKey, method: 'onExecutionAnimationCompleted' }
                );
            }
            
            if (!targetLegs) {
                throw new GameError(
                    `Target legs not found for entityId: ${action.targetId}`,
                    ErrorType.COMPONENT_ERROR,
                    { targetId: action.targetId, method: 'onExecutionAnimationCompleted' }
                );
            }
            
            let finalDamage = 0;
            let finalTargetPartKey = action.targetPartKey;
            let resultMessage = '';
            const declarationMessage = `${attackerInfo.name}の${attackingPart.type}攻撃！　${attackingPart.trait}！`;
            
            // --- 1. 回避判定 ---
            const evasionChance = calculateEvasionChance(targetLegs.mobility, attackingPart.success);
            const evasionRoll = Math.random();

            if (evasionRoll < evasionChance) {
                // 回避成功
                finalDamage = 0;
                resultMessage = `${targetInfo.name}は攻撃を回避！`;
            } else {
                // 回避失敗（命中確定）
                
                // ★新規: 2. クリティカル判定
                const critChance = calculateCriticalChance(attackingPart, targetLegs);
                const critRoll = Math.random();
                const isCritical = critRoll < critChance;

                let defenseSuccess = false;

                if (isCritical) {
                    // クリティカルヒットの場合、防御判定は行わない
                    resultMessage = 'クリティカル！　';
                } else {
                    // 通常ヒットの場合のみ、防御判定を行う
                    const defenseChance = calculateDefenseChance(targetLegs.armor);
                    const defenseRoll = Math.random();
                    if (defenseRoll < defenseChance) {
                        const defensePartKey = findBestDefensePart(this.world, action.targetId);
                        if (defensePartKey) {
                            defenseSuccess = true;
                            finalTargetPartKey = defensePartKey;
                        }
                    }
                }

                // --- 3. ダメージ計算 ---
                // ★変更: isCritical, defenseSuccess の状態に応じて、適切なフラグを立ててダメージ計算を呼び出す
                finalDamage = calculateDamage(
                    this.world, 
                    executor, 
                    action.targetId, 
                    action, 
                    isCritical, // isCritical: trueなら回避度・防御度を無視
                    !isCritical && !defenseSuccess // isDefenseBypassed: クリティカルでなく、かつ防御失敗時にtrue
                );
                
                // ★改善: PartKeyToInfoMap を使用して、パーツキーから日本語名を動的に取得
                const finalTargetPartName = PartKeyToInfoMap[finalTargetPartKey]?.name || '不明な部位';
                if (defenseSuccess) {
                    resultMessage = `${targetInfo.name}は${finalTargetPartName}で防御！ ${finalTargetPartName}に${finalDamage}ダメージ！`;
                } else {
                    // ★変更: クリティカルの場合、既存のresultMessageに追記する
                    resultMessage += `${targetInfo.name}の${finalTargetPartName}に${finalDamage}ダメージ！`;
                }
            }
            
            // --- 4. 結果をActionコンポーネントに一時保存 ---        
            action.targetPartKey = finalTargetPartKey;

            // ★修正: 計算結果をイベントペイロードで直接渡す
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: ModalType.ATTACK_DECLARATION,
                data: {
                    entityId: executor,
                    message: declarationMessage,
                    // 後続の処理で必要になるデータをペイロードに含める
                    damage: finalDamage,
                    resultMessage: resultMessage,
                    targetId: action.targetId,
                    targetPartKey: finalTargetPartKey,
                },
                immediate: true
            });
        } catch (error) {
            ErrorHandler.handle(error, { method: 'onExecutionAnimationCompleted', detail });
        }
    }
}
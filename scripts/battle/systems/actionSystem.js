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
            // ★変更: ペイロードから resolvedEffects, guardianInfo を受け取る
            const { entityId, resolvedEffects, isEvaded, isSupport, guardianInfo } = detail;

            // パラメータの検証
            if (typeof entityId !== 'number') {
                throw new GameError(
                    `Invalid parameters in attack declaration confirmation: entityId=${entityId}`,
                    ErrorType.VALIDATION_ERROR,
                    { detail, method: 'onAttackDeclarationConfirmed' }
                );
            }

            // ★変更: resolvedEffects, guardianInfo を含んだ新しいペイロードで ACTION_EXECUTED を発行
            this.world.emit(GameEvents.ACTION_EXECUTED, {
                attackerId: entityId,
                resolvedEffects: resolvedEffects || [], // 効果がなくても空配列を渡す
                isEvaded: isEvaded || false,
                isSupport: isSupport || false,
                guardianInfo: guardianInfo || null, // ★新規: ガード情報を引き継ぐ
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
            const parts = this.getCachedComponent(executor, Parts); // ★追加
            if (!action || !gameState || !parts) return;
            
            // ★修正: 移動後ターゲット決定ロジックをデータ駆動型にリファクタリング
            // ★修正: マジックストリングの代わりに定数を使用
            if (action.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
                const selectedPart = parts[action.partKey];
                const strategyKey = selectedPart?.postMoveTargeting;
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
                // ★修正: 失敗した場合でも、後続システムのために空のEFFECTS_RESOLVEDを発行する
                this.world.emit(GameEvents.EFFECTS_RESOLVED, { attackerId: executor, resolvedEffects: [], isEvaded: false, isSupport: false, guardianInfo: null });
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            let { action, attackerInfo, attackerParts, targetInfo, targetParts } = components;
            
            // ★★★ ここからが新しいロジック ★★★
            const attackingPart = attackerParts[action.partKey];
            let targetLegs = targetParts ? targetParts.legs : null;

            // --- ▼▼▼ ここからがリファクタリング箇所 ▼▼▼ ---
            // ★リファクタリング: ガード役の索敵ロジックを `queryUtils` に移譲
            let guardian = null; // ガードを実行する機体情報
            const isSingleDamageAction = !attackingPart.role.isSupport && [ActionType.SHOOT, ActionType.MELEE].includes(attackingPart.role.actionType) && action.targetId !== null;

            if (isSingleDamageAction) {
                // ★修正: 汎用クエリ関数 `findGuardian` を呼び出す
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
            // --- ▲▲▲ リファクタリング箇所ここまで ▲▲▲ ---


            // 手順2: 攻撃の命中結果（回避、クリティカル、防御）を決定します。
            const outcome = this._resolveHitOutcome(attackingPart, targetLegs, action.targetId, action.targetPartKey, executor);

            // 手順3: パーツに定義された効果を解決(resolve)する
            const resolvedEffects = [];
            // 命中したか、ターゲットがいないアクション（援護など）の場合のみ効果を解決
            if (outcome.isHit || !action.targetId) {
                if (attackingPart.effects && Array.isArray(attackingPart.effects)) {
                    for (const effect of attackingPart.effects) {
                        // ★リファクタリング: effect.strategy の代わりに effect.type を使用
                        const strategy = effectStrategies[effect.type];
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
            // ★★★ リファクタリングの核心部 ★★★
            // 手順3.5: 効果の「解決」が完了したことを、他のシステム（EffectApplicator, State, History）に通知します。
            // これにより、UIの表示を待たずに、ゲームロジックが先行して状態を更新できます。
            const resolvedPayload = {
                attackerId: executor,
                resolvedEffects: resolvedEffects,
                isEvaded: !outcome.isHit,
                // ★修正: isSupportフラグをパーツのロール定義から取得
                isSupport: attackingPart.role.isSupport,
                guardianInfo: guardian,
            };
            this.world.emit(GameEvents.EFFECTS_RESOLVED, resolvedPayload);

            // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
            // ★修正: リーダーが破壊されゲームオーバーになった場合、後続のモーダル表示処理などをスキップする
            // このチェックにより、ゲームオーバーモーダルと攻撃宣言モーダルの競合を防ぎます。
            if (this.battlePhaseContext.battlePhase === GamePhaseType.GAME_OVER) {
                // 攻撃シーケンスを完了させ（攻撃者の状態をリセットするため）、この後の処理を中断します。
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---

            // 手順4: 攻撃宣言モーダルを表示し、計算結果をUI層に伝達します。
            const primaryEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE) || resolvedEffects[0] || {};
            // ★修正: 支援行動かどうかの判定をパーツのロール定義から取得
            const isSupportAction = attackingPart.role.isSupport;
            
            let declarationMessage;
            // ★修正: 宣言メッセージの生成ロジックをデータ駆動化されたプロパティで分岐
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
                    resolvedEffects: resolvedEffects, // ★変更: 計算された効果のリストを渡す
                    guardianInfo: guardian, // ★新規: ガード役の情報をUIに渡す
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
     * ★廃止: この責務は `queryUtils.js` の `findGuardian` に移管されました。
     */
    // _findGuardian(originalTargetId) { ... }

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
        // ★修正: 支援行動は必ず「命中」する（パーツのロール定義から判定）
        if (attackingPart.role.isSupport) {
            return { isHit: true, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // ターゲットがいない（空振り）場合は命中しない
        if (!targetId || !targetLegs) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        // ★修正: CombatCalculatorを使用して回避率を計算
        const evasionChance = CombatCalculator.calculateEvasionChance({
            world: this.world,
            attackerId: executorId,
            targetLegs: targetLegs,
            attackingPart: attackingPart,
        });
        if (Math.random() < evasionChance) {
            return { isHit: false, isCritical: false, isDefended: false, finalTargetPartKey: initialTargetPartKey };
        }

        let isCritical = false;
        let isDefended = false;
        let finalTargetPartKey = initialTargetPartKey;

        // ★修正: CombatCalculatorを使用してクリティカル率を計算
        const critChance = CombatCalculator.calculateCriticalChance({ attackingPart, targetLegs });
        isCritical = Math.random() < critChance;

        if (!isCritical) {
            // ★修正: CombatCalculatorを使用して防御率を計算
            const defenseChance = CombatCalculator.calculateDefenseChance({ targetLegs });
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
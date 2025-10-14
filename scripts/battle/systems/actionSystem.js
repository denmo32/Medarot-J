/**
 * @file アクション実行システム
 * このファイルは、エンティティによって選択されたアクションを実際に実行する責務を持ちます。
 */
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { GameState, PlayerInfo, Parts, Action, ActiveEffects } from '../core/components.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
// ★改善: PartInfo, PartKeyToInfoMapを参照し、定義元を一元化
import { PlayerStateType, ModalType, GamePhaseType, PartInfo, PartKeyToInfoMap, EffectType } from '../common/constants.js';
// ★修正: findMostDamagedAllyPart をインポート
import { findBestDefensePart, findNearestEnemy, selectRandomPart, getValidAllies, findMostDamagedAllyPart } from '../utils/queryUtils.js';
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
            if (!action || !gameState) return;
            
            // ★修正: post-moveのアクションタイプに応じてターゲット決定ロジックを分岐
            if (action.properties.targetTiming === 'post-move' && action.targetId === null) {
                let targetData = null;

                // ★修正: 格闘と妨害は最も近い敵をターゲットにする
                if (action.type === '格闘' || action.type === '妨害') {
                    const nearestEnemyId = findNearestEnemy(this.world, executor);
                    if (nearestEnemyId !== null) {
                        targetData = selectRandomPart(this.world, nearestEnemyId);
                    }
                } else if (action.type === '回復') {
                    // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
                    // 1. 回復対象となりうる味方（自分自身も含む）のリストを取得する
                    const allies = getValidAllies(this.world, executor, true);
                    // 2. ★修正: AI戦略(HEALER)への依存をなくし、汎用的なクエリ関数を呼び出す
                    targetData = findMostDamagedAllyPart(this.world, allies);
                    // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
                }

                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                } else {
                    // ターゲットが見つからなかった場合（格闘対象がいない、回復対象がいない）
                    // ターゲットはnullのままアニメーションへ移行し、「空振り」として処理される
                    console.warn(`ActionSystem: No valid target for post-move action '${action.type}' by ${executor}.`);
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
                // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
                // ★修正: 失敗した場合でも、後続システムのために空のEFFECTS_RESOLVEDを発行する
                this.world.emit(GameEvents.EFFECTS_RESOLVED, { attackerId: executor, resolvedEffects: [], isEvaded: false, isSupport: false, guardianInfo: null });
                // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
                this.world.emit(GameEvents.ATTACK_SEQUENCE_COMPLETED, { entityId: executor });
                return;
            }
            let { action, attackerInfo, attackerParts, targetInfo, targetParts } = components;
            
            // ★★★ ここからが新しいロジック ★★★
            const attackingPart = attackerParts[action.partKey];
            let targetLegs = targetParts ? targetParts.legs : null;

            // ★新規: ガード役の索敵とターゲットの上書き
            let guardian = null; // ガードを実行する機体情報
            const isSingleDamageAction = ['射撃', '格闘'].includes(attackingPart.action) && action.targetId !== null;

            if (isSingleDamageAction) {
                guardian = this._findGuardian(action.targetId);
                if (guardian) {
                    // ターゲットをガード役に上書き
                    action.targetId = guardian.id;
                    action.targetPartKey = guardian.partKey;
                    // 上書き後のターゲット情報を再取得
                    targetParts = this.getCachedComponent(guardian.id, Parts);
                    targetLegs = targetParts ? targetParts.legs : null;
                }
            }
            // --- ガード処理ここまで ---

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
            // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
            // ★★★ リファクタリングの核心部 ★★★
            // 手順3.5: 効果の「解決」が完了したことを、他のシステム（EffectApplicator, State, History）に通知します。
            // これにより、UIの表示を待たずに、ゲームロジックが先行して状態を更新できます。
            const resolvedPayload = {
                attackerId: executor,
                resolvedEffects: resolvedEffects,
                isEvaded: !outcome.isHit,
                isSupport: ['援護', '回復', '妨害', '防御'].includes(attackingPart.action),
                guardianInfo: guardian,
            };
            this.world.emit(GameEvents.EFFECTS_RESOLVED, resolvedPayload);
            // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---

            // 手順4: 攻撃宣言モーダルを表示し、計算結果をUI層に伝達します。
            const primaryEffect = resolvedEffects.find(e => e.type === EffectType.DAMAGE) || resolvedEffects[0] || {};
            // ★修正: 援護・回復・妨害・防御アクションをまとめてisSupportActionとして扱う
            const isSupportAction = ['援護', '回復', '妨害', '防御'].includes(attackingPart.action);
            
            let declarationMessage;
            // ★修正: 防御アクションのメッセージを追加
            if (attackingPart.action === '防御') {
                declarationMessage = `${attackerInfo.name}の守る行動！ ${attackingPart.trait}！`;
            } else if (attackingPart.action === '妨害') {
                declarationMessage = `${attackerInfo.name}の妨害行動！ ${attackingPart.trait}！`;
            } else if (isSupportAction) {
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
     * ★新規: 指定されたターゲットのチームから、ガード状態の機体を探します。
     * 複数いる場合は、ガードパーツのHPが最も高い機体を返します。
     * @param {number} originalTargetId - 本来の攻撃ターゲットのエンティティID
     * @returns {{id: number, partKey: string, name: string} | null} ガード役の情報、またはnull
     */
    _findGuardian(originalTargetId) {
        const targetInfo = this.getCachedComponent(originalTargetId, PlayerInfo);
        if (!targetInfo) return null;

        const potentialGuardians = this.world.getEntitiesWith(PlayerInfo, GameState, ActiveEffects, Parts)
            // --- ▼▼▼ ここからが修正箇所 ▼▼▼ ---
            .filter(id => {
                // [修正] ガード役は、本来の攻撃対象自身であってはなりません。
                if (id === originalTargetId) return false;

                const info = this.getCachedComponent(id, PlayerInfo);
                const state = this.getCachedComponent(id, GameState);
                // 状態(state)ではなく、ActiveEffectsにガード効果があるかで判定します。
                const activeEffects = this.getCachedComponent(id, ActiveEffects);
                const hasGuardEffect = activeEffects && activeEffects.effects.some(e => e.type === EffectType.APPLY_GUARD);
                
                // チームが同じで、破壊されておらず、ガード効果を持っている必要があります。
                return info.teamId === targetInfo.teamId && state.state !== PlayerStateType.BROKEN && hasGuardEffect;
            })
            // --- ▲▲▲ 修正箇所ここまで ▲▲▲ ---
            .map(id => {
                const activeEffects = this.getCachedComponent(id, ActiveEffects);
                const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
                const parts = this.getCachedComponent(id, Parts);
                const info = this.getCachedComponent(id, PlayerInfo);

                if (guardEffect && parts[guardEffect.partKey] && !parts[guardEffect.partKey].isBroken) {
                    return {
                        id: id,
                        partKey: guardEffect.partKey,
                        partHp: parts[guardEffect.partKey].hp,
                        name: info.name,
                    };
                }
                return null;
            })
            .filter(g => g !== null);

        if (potentialGuardians.length === 0) return null;

        // ガードパーツのHPが最も高い機体を優先
        potentialGuardians.sort((a, b) => b.partHp - a.partHp);
        
        return potentialGuardians[0];
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
        // ★修正: 援護・回復・妨害・防御行動は必ず「命中」する
        if (['援護', '回復', '妨害', '防御'].includes(attackingPart.action)) {
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
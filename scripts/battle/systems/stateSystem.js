import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../core/components/index.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, ModalType, GamePhaseType, TeamID, EffectType, EffectScope, PartInfo, TargetTiming } from '../common/constants.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * エンティティの「状態」を管理するステートマシン（状態遷移機械）としての役割を担うシステム。
 * 「チャージ中は行動できない」「行動後はクールダウンに入る」といった
 * ゲームの基本的な流れは、すべてこのシステムによる状態遷移によって制御されています。
 * 他のシステムは、ここで設定された状態を見て、自身の振-舞いを決定します。
 */
export class StateSystem {
    constructor(world) {
        this.world = world;
        // Use new context components
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);

        // 他のシステムから発行される、状態遷移のきっかけとなるイベントを購読します。
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.EFFECTS_RESOLVED, this.onEffectsResolved.bind(this));
        this.world.on(GameEvents.ATTACK_SEQUENCE_COMPLETED, this.onAttackSequenceCompleted.bind(this));
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        // パーツ破壊イベントを購読し、行動予約のキャンセルをイベント駆動で行う
        this.world.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
        // 効果が切れたイベントを購読し、状態遷移を管理する
        this.world.on(GameEvents.EFFECT_EXPIRED, this.onEffectExpired.bind(this));
    }
    
    // onPlayerBrokenハンドラを追加
    /**
     * 頭部が破壊された（機能停止した）際に呼び出されます。
     * @param {object} detail - { entityId }
     */
    onPlayerBroken(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (gameState) {
            // UI（UISystem）が`.broken`クラスを適用するためのトリガーとして状態を設定
            gameState.state = PlayerStateType.BROKEN;
        }
        if (gauge) {
            // ゲージ進行を完全に停止
            gauge.value = 0;
        }
        // Actionコンポーネントをリセット
        this.world.addComponent(entityId, new Action());
    }


    /**
     * プレイヤーまたはAIが行動を選択した際に呼び出されます。
     * @param {object} detail - 選択された行動の詳細情報
     */
    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        // 1. 基本的な検証: パーツが選択されているか、壊れていないかを確認します。
        // この検証は actionUtils の decideAndEmitAction で既に行われているが、念のため残す
        if (!partKey || !parts[partKey] || parts[partKey].isBroken) {
            console.warn(`StateSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const selectedPart = parts[partKey];

        // 3. 選択されたアクションの内容をActionコンポーネントに記録します。
        action.partKey = partKey;
        action.type = selectedPart.action; // UI表示用の日本語アクション名を保持
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        // アクションの特性(targetTiming)を、マージ済みのパーツデータから設定
        action.targetTiming = selectedPart.targetTiming;

        // 4. エンティティの状態を「行動選択済みチャージ中」へ遷移させます。
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 5. ゲージをリセットし、行動実行までのチャージを開始させます。
        gauge.value = 0;

        // 6. 選択されたパーツに応じて、チャージ速度の補正率を計算・設定します。
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: selectedPart, factorType: 'charge' });
    }


    /**
     * このシステムが担当する状態遷移（GLITCH, GUARD）に特化
     * @param {object} detail - 行動の実行結果
     */
    onEffectsResolved(detail) {
        const { resolvedEffects, attackerId } = detail;
        if (!resolvedEffects || resolvedEffects.length === 0) {
            return;
        }

        for (const effect of resolvedEffects) {
            // GLITCH効果による状態遷移をここで処理
            if (effect.type === EffectType.APPLY_GLITCH && effect.wasSuccessful) {
                // 成功した場合、ターゲットの行動を中断させクールダウンに移行
                this.resetEntityStateToCooldown(effect.targetId, { interrupted: true });
            } 
            // GUARD効果による状態遷移をここで処理
            else if (effect.type === EffectType.APPLY_GUARD) {
                const gameState = this.world.getComponent(attackerId, GameState);
                if (gameState) {
                    gameState.state = PlayerStateType.GUARDING;
                    
                    // 実行ラインに留まるため、位置を固定
                    const position = this.world.getComponent(attackerId, Position);
                    const playerInfo = this.world.getComponent(attackerId, PlayerInfo);
                    if (position && playerInfo) {
                        position.x = playerInfo.teamId === TeamID.TEAM1
                            ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                            : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
                    }
                }
            }
        }
    }

    /**
     * 攻撃シーケンス完了後、攻撃者の状態をリセットします。
     * @param {object} detail - { entityId }
     */
    onAttackSequenceCompleted(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);

        // ガード状態の機体は行動完了後もクールダウンに移行せず、状態を維持します。
        // これにより、行動実行ラインに留まり、味方を庇うことができます。
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            // Actionコンポーネントのみをリセットし、次のガードに備えます。
            this.world.addComponent(entityId, new Action());
            return; // クールダウン処理をスキップします。
        }

        this.resetEntityStateToCooldown(entityId);
    }

    /**
     * ゲージが満タンになった際のハンドラ
     * @param {object} detail - { entityId }
     */
    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            gameState.state = PlayerStateType.READY_EXECUTE;

            const position = this.world.getComponent(entityId, Position);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);

            if (playerInfo.teamId === TeamID.TEAM1) {
                position.x = CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1;
            } else {
                position.x = CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
            }
        }
    }
    
    /**
     * リファクタリング: パーツ破壊イベントのハンドラ。
     * 行動予約中のパーツが破壊されたり、ターゲットが機能停止した場合に行動をキャンセルします。
     * @param {object} detail - PART_BROKEN イベントのペイロード { entityId, partKey }
     */
    onPartBroken(detail) {
        const { entityId: brokenEntityId, partKey: brokenPartKey } = detail;

        // 行動予約中のエンティティを全てチェック
        const actors = this.world.getEntitiesWith(GameState, Action, PlayerInfo, Parts);
        for (const actorId of actors) {
            const gameState = this.world.getComponent(actorId, GameState);
            if (gameState.state !== PlayerStateType.SELECTED_CHARGING) {
                continue;
            }

            const action = this.world.getComponent(actorId, Action);
            const actorInfo = this.world.getComponent(actorId, PlayerInfo);
            const actorParts = this.world.getComponent(actorId, Parts);
            const selectedPart = actorParts[action.partKey];

            // 1. 自身の予約パーツが破壊された場合
            if (actorId === brokenEntityId && action.partKey === brokenPartKey) {
                // メッセージ生成をMessageSystemに委譲するため、イベントを発行
                this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: 'PART_BROKEN' });
                this.resetEntityStateToCooldown(actorId, { interrupted: true });
                // 一つのエンティティに対する処理は一度で十分なので、次のエンティティへ
                continue; 
            }
            
            // 2. ターゲットが機能停止した場合 (頭部破壊)
            if (selectedPart?.targetScope?.endsWith('_SINGLE') &&
                action.targetId === brokenEntityId && 
                brokenPartKey === PartInfo.HEAD.key) 
            {
                // メッセージ生成をMessageSystemに委譲するため、イベントを発行
                this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: actorId, reason: 'TARGET_LOST' });
                this.resetEntityStateToCooldown(actorId, { interrupted: true });
                continue;
            }
        }
    }

    /**
     * 効果が切れた際のイベントハンドラ。
     * @param {object} detail - EFFECT_EXPIRED イベントのペイロード { entityId, effect }
     */
    onEffectExpired(detail) {
        const { entityId, effect } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        
        // ガード効果が切れた場合、かつ現在ガード中であればクールダウンに移行
        if (effect.type === EffectType.APPLY_GUARD && gameState?.state === PlayerStateType.GUARDING) {
            const parts = this.world.getComponent(entityId, Parts);
            const guardPart = parts[effect.partKey];
            if (guardPart?.isBroken) {
                 // メッセージ生成をMessageSystemに委譲するため、イベントを発行
                 this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
            }
            this.resetEntityStateToCooldown(entityId);
        }
    }

    /**
     * 攻撃者だけでなく、任意のエンティティの状態をクールダウン中にリセットする汎用関数。
     * Actionコンポーネントをクリアします。
     * @param {number} entityId - 状態をリセットするエンティティのID
     * @param {object} options - 挙動を制御するオプション
     * @param {boolean} options.interrupted - 行動が中断されたかどうかのフラグ
     */
    resetEntityStateToCooldown(entityId, options = {}) {
        const { interrupted = false } = options;
        const parts = this.world.getComponent(entityId, Parts); // Partsを最初に取得
        
        // 機能停止している場合は、いかなる状態遷移も行わない
        if (parts?.head?.isBroken) {
            return;
        }
        
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);

        // ガード状態を解除
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }

        if (action && action.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            // CombatCalculator を使用して速度補正を計算
            if (usedPart) {
                gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: usedPart, factorType: 'cooldown' });
            } else {
                gauge.speedMultiplier = 1.0;
            }
        } else if (gauge) {
            gauge.speedMultiplier = 1.0;
        }
        if (gameState) gameState.state = PlayerStateType.CHARGING;
        if (gauge) {
            if (interrupted) {
                // 中断された場合、チャージした分がそのままクールダウンの残り時間になる
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
        }
        if (action) {
            // Actionコンポーネントをリセット
            this.world.addComponent(entityId, new Action());
        }
    }

    /**
     * 時間経過による状態遷移を管理します。
     */
    update(deltaTime) {
        try {
        } catch (error) {
            ErrorHandler.handle(error, { method: 'StateSystem.update', deltaTime });
        }
    }
}
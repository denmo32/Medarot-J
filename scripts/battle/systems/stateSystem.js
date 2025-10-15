import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../core/components.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
import { CONFIG } from '../common/config.js'; // ★追加
import { GameEvents } from '../common/events.js';
// ★変更: EffectType, EffectScope をインポート
import { PlayerStateType, ModalType, GamePhaseType, TeamID, EffectType, EffectScope, PartInfo, TargetTiming } from '../common/constants.js'; // ★ PartInfo と TargetTiming をインポート
import { isValidTarget } from '../utils/queryUtils.js';
// ★修正: calculateSpeedMultiplier の代わりに CombatCalculator をインポート
import { CombatCalculator } from '../utils/combatFormulas.js';

/**
 * エンティティの「状態」を管理するステートマシン（状態遷移機械）としての役割を担うシステム。
 * なぜこのシステムが重要か？
 * ゲームのルールそのものを定義するからです。「チャージ中は行動できない」「行動後はクールダウンに入る」といった
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
        // --- ▼▼▼ ここからがリファクタリング箇所 ▼▼▼ ---
        // ★リファクタリング: パーツ破壊イベントを購読し、行動予約のキャンセルをイベント駆動で行う
        this.world.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
        // --- ▲▲▲ リファクタリング箇所ここまで ▲▲▲ ---
    }
    
    // ★新規: onPlayerBrokenハンドラを追加
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

        // ★修正: ターゲット検証ロジックを削除。責務を actionUtils に移譲。

        // 3. 選択されたアクションの内容をActionコンポーネントに記録します。
        action.partKey = partKey;
        action.type = selectedPart.action; // UI表示用の日本語アクション名を保持
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        // ★修正: アクションの特性(targetTiming)を、Actionコンポーネントの直下プロパティとして設定
        action.targetTiming = selectedPart.targetTiming || TargetTiming.PRE_MOVE;

        // 4. エンティティの状態を「行動選択済みチャージ中」へ遷移させます。
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 5. ゲージをリセットし、行動実行までのチャージを開始させます。
        gauge.value = 0;

        // 6. ★修正: 選択されたパーツに応じて、チャージ速度の補正率を計算・設定します。
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: selectedPart, factorType: 'charge' });
    }


    /**
     * ActionSystemによって行動が実行され、その結果が通知された際に呼び出されます。
     * @param {object} detail - 行動の実行結果
     */
    onEffectsResolved(detail) {
        const { resolvedEffects } = detail;
        if (!resolvedEffects || resolvedEffects.length === 0) {
            return;
        }

        for (const effect of resolvedEffects) {
            if (effect.type === EffectType.APPLY_GLITCH) {
                // ★新規: グリッチ効果の処理
                if (effect.wasSuccessful) {
                    // 成功した場合、ターゲットの行動を中断させクールダウンに移行
                    this.resetEntityStateToCooldown(effect.targetId, { interrupted: true });
                }
            } else if (effect.type === EffectType.APPLY_GUARD) {
                // ★新規: ガード効果の処理
                const { targetId } = effect;
                const gameState = this.world.getComponent(targetId, GameState);
                if (gameState) {
                    // ★修正: APPLY_GUARD効果の適用はEffectApplicatorSystemが行うため、ここでは状態遷移のみを担当
                    gameState.state = PlayerStateType.GUARDING;
                    
                    // 実行ラインに留まるため、位置を固定
                    const position = this.world.getComponent(targetId, Position);
                    const playerInfo = this.world.getComponent(targetId, PlayerInfo);
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
     * ★新規: 攻撃シーケンス完了後、攻撃者の状態をリセットします。
     * @param {object} detail - { entityId }
     */
    onAttackSequenceCompleted(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);

        // [修正] ガード状態の機体は行動完了後もクールダウンに移行せず、状態を維持します。
        // これにより、行動実行ラインに留まり、味方を庇うことができます。
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            // Actionコンポーネントのみをリセットし、次のガードに備えます。
            this.world.addComponent(entityId, new Action());
            return; // クールダウン処理をスキップします。
        }

        this.resetEntityStateToCooldown(entityId);
    }

    /**
     * ★新規: ゲージが満タンになった際のハンドラ
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
     * ★新規・リファクタリング: パーツ破壊イベントのハンドラ。
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

            // 1. 自身の予約パーツが破壊された場合
            if (actorId === brokenEntityId && action.partKey === brokenPartKey) {
                const message = `${actorInfo.name}の行動予約パーツが破壊されたため、放熱に移行！`;
                this.uiStateContext.messageQueue.push(message);
                this.resetEntityStateToCooldown(actorId, { interrupted: true });
                // 一つのエンティティに対する処理は一度で十分なので、次のエンティティへ
                continue; 
            }

            // 2. ターゲットが機能停止した場合 (頭部破壊)
            const partScope = actorParts[action.partKey]?.targetScope;
            if ([EffectScope.ENEMY_SINGLE, EffectScope.ALLY_SINGLE].includes(partScope) &&
                action.targetId === brokenEntityId && 
                brokenPartKey === PartInfo.HEAD.key) 
            {
                const message = `ターゲットロスト！ ${actorInfo.name}は放熱に移行！`;
                this.uiStateContext.messageQueue.push(message);
                this.resetEntityStateToCooldown(actorId, { interrupted: true });
                continue;
            }
        }
    }

    /**
     * ★修正: 攻撃者だけでなく、任意のエンティティの状態をクールダウン中にリセットする汎用関数。
     * Actionコンポーネントをクリアします。
     * @param {number} entityId - 状態をリセットするエンティティのID
     * @param {object} options - 挙動を制御するオプション
     * @param {boolean} options.interrupted - 行動が中断されたかどうかのフラグ
     */
    resetEntityStateToCooldown(entityId, options = {}) {
        const { interrupted = false } = options;
        const parts = this.world.getComponent(entityId, Parts); // ★ Parts を最初に取得
        
        // --- ▼▼▼ ここからがステップ3の変更箇所 ▼▼▼ ---
        // ★修正: 機能停止している場合は、いかなる状態遷移も行わない
        if (parts?.head?.isBroken) {
            return;
        }
        // --- ▲▲▲ ステップ3の変更箇所ここまで ▲▲▲ ---
        
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);
        const action = this.world.getComponent(entityId, Action);

        // ★新規: ガード状態を解除
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }

        if (action && action.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            // ★修正: CombatCalculator を使用して速度補正を計算
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
        // --- ▼▼▼ ここからがリファクタリング箇所 ▼▼▼ ---
        // ★リファクタリング: 行動予約中のパーツ破壊やターゲットロストのチェックを削除。
        // この処理は onPartBroken イベントハンドラに移管されました。
        const entities = this.world.getEntitiesWith(GameState, ActiveEffects, Parts);
        // --- ▲▲▲ リファクタリング箇所ここまで ▲▲▲ ---

        for (const entityId of entities) {
            const gameState = this.world.getComponent(entityId, GameState);
            
            // ★新規: ガード状態の監視
            if (gameState.state === PlayerStateType.GUARDING) {
                const activeEffects = this.world.getComponent(entityId, ActiveEffects);
                const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
                const parts = this.world.getComponent(entityId, Parts);

                // ガード効果が存在しない、回数が0以下、またはガードパーツが破壊された場合、ガードを解除してクールダウンへ
                if (!guardEffect || guardEffect.count <= 0 || (guardEffect.partKey && parts[guardEffect.partKey]?.isBroken)) {
                    if (guardEffect && parts[guardEffect.partKey]?.isBroken) {
                        const message = "ガードパーツ破壊！ ガード解除！";
                        this.uiStateContext.messageQueue.push(message);
                    }
                    this.resetEntityStateToCooldown(entityId);
                    continue;
                }
            }
        }
    }
}
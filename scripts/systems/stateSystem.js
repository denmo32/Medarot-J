/**
 * @file 状態管理システム
 * このファイルは、ゲーム内のすべてのエンティティの状態（GameState）を管理・更新する責務を持ちます。
 */

import { Gauge, GameState, Parts, PlayerInfo, Action, GameContext } from '../core/components.js';
import { CONFIG } from '../common/config.js'; // ★追加
import { GameEvents } from '../common/events.js';
import { PlayerStateType } from '../common/constants.js';

/**
 * エンティティの「状態」を管理するステートマシン（状態遷移機械）としての役割を担うシステム。
 * なぜこのシステムが重要か？
 * ゲームのルールそのものを定義するからです。「チャージ中は行動できない」「行動後はクールダウンに入る」といった
 * ゲームの基本的な流れは、すべてこのシステムによる状態遷移によって制御されています。
 * 他のシステムは、ここで設定された状態を見て、自身の振る舞いを決定します。
 */
export class StateSystem {
    constructor(world) {
        this.world = world;
        this.context = this.world.getSingletonComponent(GameContext);

        // 他のシステムから発行される、状態遷移のきっかけとなるイベントを購読します。
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
        this.world.on(GameEvents.ATTACK_SEQUENCE_COMPLETED, this.onAttackSequenceCompleted.bind(this));
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

        // ★変更: アクションの有効性を、パーツの存在とアクションタイプに基づいて多段階で検証します。

        // 1. 基本的な検証: パーツが選択されているか、壊れていないかを確認します。
        if (!partKey || !parts[partKey] || parts[partKey].isBroken) {
            console.warn(`StateSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const actionType = parts[partKey].action;

        // 2. ターゲットの検証: アクションタイプに応じてターゲットの要件を確認します。
        if (actionType === '射撃') {
            // 射撃の場合、ターゲットが必須です。
            const isTargetValid = targetId !== null && targetId !== undefined && targetPartKey !== null && targetPartKey !== undefined;
            if (!isTargetValid) {
                console.warn(`StateSystem: Shooting action for entity ${entityId} lacks a valid target. Re-queueing.`, detail);
                this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
                return;
            }
        } 
        // 格闘の場合は、この時点ではターゲットがnullでも許容されます。

        // 3. 選択されたアクションの内容をActionコンポーネントに記録します。
        action.partKey = partKey;
        action.type = actionType;
        action.targetId = targetId; // 格闘の場合はnullが設定される
        action.targetPartKey = targetPartKey; // 格闘の場合はnullが設定される

        // 4. エンティティの状態を「行動選択済みチャージ中」へ遷移させます。
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 5. ゲージをリセットし、行動実行までのチャージを開始させます。
        gauge.value = 0;

        // ★新規: 選択されたパーツに応じて、チャージ速度の補正率を計算・設定します。
        const selectedPart = parts[partKey];
        gauge.speedMultiplier = this._calculateSpeedMultiplier(selectedPart, 'charge');
    }

    /**
     * ActionSystemによって行動が実行され、その結果が通知された際に呼び出されます。
     * @param {object} detail - 行動の実行結果
     */
    onActionExecuted(detail) {
        const { attackerId, targetId, targetPartKey, damage, isPartBroken, isPlayerBroken } = detail;

        // ★追加: ターゲットがいない場合（格闘の空振りなど）は攻撃者の状態をリセットして終了
        if (!targetId) {
            this.resetAttackerState(attackerId);
            return;
        }

        // 1. ダメージをターゲットのパーツHPに反映させます。
        const targetParts = this.world.getComponent(targetId, Parts);
        const part = targetParts[targetPartKey];
        part.hp = Math.max(0, part.hp - damage);

        // 2. パーツが破壊された場合の状態更新とイベント発行
        if (isPartBroken) {
            part.isBroken = true;
            // 他のシステム（UIなど）にパーツ破壊を通知します。
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey: targetPartKey });
        }

        // 3. プレイヤー自体が機能停止（頭部破壊）した場合の処理
        if (isPlayerBroken) {
            const gameState = this.world.getComponent(targetId, GameState);
            const gauge = this.world.getComponent(targetId, Gauge);
            // 状態を「破壊」に即時変更し、以降の行動をすべて不能にします。
            gameState.state = PlayerStateType.BROKEN;
            gauge.value = 0; 
            // GameFlowSystemにプレイヤー破壊を通知し、ゲームオーバー判定を促します。
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId });
        }

        // 4. 攻撃者の状態リセットは onAttackSequenceCompleted に移動
    }

    /**
     * ★新規: 攻撃シーケンス完了後、攻撃者の状態をリセットします。
     * @param {object} detail - { entityId }
     */
    onAttackSequenceCompleted(detail) {
        const { entityId } = detail;
        this.resetAttackerState(entityId);
    }

    /**
     * ★新規: パーツ性能に基づき、速度補正率を計算するヘルパー関数
     * @param {object} part - パーツオブジェクト
     * @param {'charge' | 'cooldown'} factorType - 計算する係数の種類
     * @returns {number} 速度補正率 (1.0が基準)
     */
    _calculateSpeedMultiplier(part, factorType) {
        if (!part) return 1.0;

        const config = CONFIG.TIME_ADJUSTMENT;
        const factor = factorType === 'charge' ? config.CHARGE_IMPACT_FACTOR : config.COOLDOWN_IMPACT_FACTOR;

        const might = part.might || 0;
        const success = part.success || 0;

        // 性能スコア = (威力 / 最大威力) + (成功 / 最大成功)
        // 基準値が0の場合のゼロ除算を避ける
        const mightScore = config.MAX_MIGHT > 0 ? might / config.MAX_MIGHT : 0;
        const successScore = config.MAX_SUCCESS > 0 ? success / config.MAX_SUCCESS : 0;
        const performanceScore = mightScore + successScore;

        // 時間補正率 = 1.0 + (性能スコア * 影響係数)
        const multiplier = 1.0 + (performanceScore * factor);

        return multiplier;
    }

    /**
     * ★新規: 攻撃者の状態をチャージ中にリセットし、Actionコンポーネントをクリアします。
     * @param {number} attackerId 
     */
    resetAttackerState(attackerId) {
        const attackerGameState = this.world.getComponent(attackerId, GameState);
        const attackerGauge = this.world.getComponent(attackerId, Gauge);
        const attackerAction = this.world.getComponent(attackerId, Action);
        const attackerParts = this.world.getComponent(attackerId, Parts);

        // 破壊されている場合は何もしない
        if (attackerGameState && attackerGameState.state === PlayerStateType.BROKEN) {
            return;
        }

        // ★新規: Actionコンポーネントがクリアされる前にパーツ情報を取得し、クールダウンの速度補正率を計算します。
        if (attackerAction && attackerAction.partKey && attackerParts && attackerGauge) {
            const usedPart = attackerParts[attackerAction.partKey];
            attackerGauge.speedMultiplier = this._calculateSpeedMultiplier(usedPart, 'cooldown');
        } else if (attackerGauge) {
            // パーツ情報がない場合（格闘の空振りなど）はデフォルト値に戻す
            attackerGauge.speedMultiplier = 1.0;
        }

        if (attackerGameState) attackerGameState.state = PlayerStateType.CHARGING;
        if (attackerGauge) attackerGauge.value = 0;
        
        if (attackerAction) {
            attackerAction.partKey = null;
            attackerAction.type = null;
            attackerAction.targetId = null;
            attackerAction.targetPartKey = null;
            attackerAction.damage = 0;
            attackerAction.resultMessage = '';
        }
    }

    /**
     * 時間経過（ゲージの蓄積）による状態遷移を管理します。
     */
    update(deltaTime) {
        const entities = this.world.getEntitiesWith(Gauge, GameState);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);

            // ゲージが満タンになった時が、状態遷移のトリガーです。
            if (gauge.value >= gauge.max) {
                if (gameState.state === PlayerStateType.CHARGING) {
                    // クールダウン完了 → 行動選択が可能になる
                    gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
                } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                    // 行動チャージ完了 → 行動実行準備が整う
                    gameState.state = PlayerStateType.READY_EXECUTE;
                }
            }

            // 行動選択が可能になったエンティティを検出します。
            const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
            if (selectableStates.includes(gameState.state)) {
                // 状態を統一し、TurnSystemに行動選択キューへの追加を要求します。
                // なぜイベントを発行するのか？
                // StateSystemは「状態を管理する」だけで、「誰が次に行動するか」は知りません。
                // その決定はTurnSystemの責務なので、関心事を分離するためにイベントで通知します。
                gameState.state = PlayerStateType.READY_SELECT;
                this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
            }
        }
    }
}

/**
 * @file 状態管理システム
 * このファイルは、ゲーム内のすべてのエンティティの状態（GameState）を管理・更新する責務を持ちます。
 */

import { Gauge, GameState, Parts, PlayerInfo, Action, Position } from '../core/components.js';
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
import { CONFIG } from '../common/config.js'; // ★追加
import { GameEvents } from '../common/events.js';
import { PlayerStateType, ModalType, GamePhaseType, TeamID } from '../common/constants.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { calculateSpeedMultiplier } from '../utils/combatFormulas.js';

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
        // Use new context components
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);

        // 他のシステムから発行される、状態遷移のきっかけとなるイベントを購読します。
        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
        this.world.on(GameEvents.ATTACK_SEQUENCE_COMPLETED, this.onAttackSequenceCompleted.bind(this));
        // ★新規: GAUGE_FULLイベントを購読
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
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
        // ★新規: アクションの特性をCONFIGから取得して設定
        action.properties = CONFIG.ACTION_PROPERTIES[actionType] || {};

        // 4. エンティティの状態を「行動選択済みチャージ中」へ遷移させます。
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 5. ゲージをリセットし、行動実行までのチャージを開始させます。
        gauge.value = 0;

        // ★新規: 選択されたパーツに応じて、チャージ速度の補正率を計算・設定します。
        const selectedPart = parts[partKey];
        gauge.speedMultiplier = calculateSpeedMultiplier(selectedPart, 'charge');
    }

    /**
     * ActionSystemによって行動が実行され、その結果が通知された際に呼び出されます。
     * @param {object} detail - 行動の実行結果
     */
    onActionExecuted(detail) {
        // ★変更: isPlayerBroken を削除。責務をHistorySystemに移管。
        const { attackerId, targetId, targetPartKey, damage, isPartBroken } = detail;

        // ターゲットがいない場合（格闘の空振りなど）は攻撃者の状態をリセットして終了
        if (!targetId) {
            this.resetAttackerState(attackerId);
            return;
        }

        // 1. ダメージをターゲットのパーツHPに反映させます。
        const targetParts = this.world.getComponent(targetId, Parts);
        // ★追加: ターゲットパーツが存在しない場合は早期リターン
        if (!targetParts || !targetParts[targetPartKey]) return;
        const part = targetParts[targetPartKey];
        part.hp = Math.max(0, part.hp - damage);

        // 2. パーツが破壊された場合の状態更新とイベント発行
        if (isPartBroken) {
            part.isBroken = true;
            // 他のシステム（UIなど）にパーツ破壊を通知します。
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey: targetPartKey });
        }

        // ★削除: プレイヤー破壊処理はHistorySystemに移動しました。
        // これにより、StateSystemは純粋な状態遷移とパーツHPの管理に集中し、
        // HistorySystemが戦闘結果（ログ、プレイヤー破壊）をまとめて扱う体制が整います。

        // 攻撃者の状態リセットは onAttackSequenceCompleted に移動
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
     * ★新規: ゲージが満タンになった際のハンドラ
     * @param {object} detail - { entityId }
     */
    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        // 念のためコンポーネントの存在をチェック
        if (!gauge || !gameState) return;

        // ゲージが満タンになった時が、状態遷移のトリガーです。
        if (gameState.state === PlayerStateType.CHARGING) {
            // クールダウン完了 → 行動選択が可能になる
            gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
            // ★変更: 即座に行動キューへの追加を要求
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            // 行動チャージ完了 → 行動実行準備が整う
            gameState.state = PlayerStateType.READY_EXECUTE;

            // ★追加: アイコン位置をアクションラインに強制設定
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
     * ★新規: 攻撃者の状態をチャージ中にリセットし、Actionコンポーネントをクリアします。
     * @param {number} attackerId - 攻撃者のエンティティID
     * @param {object} options - 挙動を制御するオプション
     * @param {boolean} options.interrupted - 行動が中断されたかどうかのフラグ
     */
    resetAttackerState(attackerId, options = {}) {
        const { interrupted = false } = options; // ★修正: 中断フラグを受け取る
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
            attackerGauge.speedMultiplier = calculateSpeedMultiplier(usedPart, 'cooldown');
        } else if (attackerGauge) {
            // パーツ情報がない場合（格闘の空振りなど）はデフォルト値に戻す
            attackerGauge.speedMultiplier = 1.0;
        }
        if (attackerGameState) attackerGameState.state = PlayerStateType.CHARGING;
        if (attackerGauge) {
            // ★修正: 中断された場合と、正常完了した場合でゲージの扱いを分ける
            if (interrupted) {
                // 中断時は、現在位置から後退を開始するためにゲージの値を反転させる
                attackerGauge.value = attackerGauge.max - attackerGauge.value;
            } else {
                // 正常完了時は、ゲージを0にリセットしてアクションラインから後退を開始
                attackerGauge.value = 0;
            }
        }
        if (attackerAction) {
            // Actionコンポーネントを再生成してリセットする
            this.world.addComponent(attackerId, new Action());
        }
    }

    /**
     * 時間経過による状態遷移を管理します。
     */
    update(deltaTime) {
        const entities = this.world.getEntitiesWith(Gauge, GameState, Action, Parts, PlayerInfo);
        for (const entityId of entities) {
            const gameState = this.world.getComponent(entityId, GameState);
            
            // ★維持: チャージ中にパーツやターゲットが破壊された場合のチェックはポーリングが必要なため維持する
            if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                const action = this.world.getComponent(entityId, Action);
                const parts = this.world.getComponent(entityId, Parts);
                
                // ① 攻撃パーツが破壊された場合
                if (action.partKey && parts[action.partKey] && parts[action.partKey].isBroken) {
                    const message = "行動予約パーツが破壊されたため、放熱に移行！";
                    // ★修正: モーダルの競合を避けるため、直接表示せずにメッセージキューに追加する
                    this.uiStateContext.messageQueue.push(message); // Use UIStateContext for messageQueue
                    this.resetAttackerState(entityId, { interrupted: true });
                    continue;
                }
                
                // ② & ③ 射撃のターゲットが破壊された場合
                if (action.type === '射撃' && action.targetId !== null) {
                    // ターゲットの有効性をチェックします。
                    // これにより、チャージ中に他の攻撃でターゲットパーツが破壊された場合を検知します。
                    if (!isValidTarget(this.world, action.targetId, action.targetPartKey)) {
                        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
                        const message = `ターゲットロスト！ ${playerInfo.name}は放熱に移行！`;
                        // メッセージをキューに追加し、モーダルでの表示を要求します。
                        this.uiStateContext.messageQueue.push(message); // Use UIStateContext for messageQueue
                        // 状態をリセットし、その地点からのクールダウンを開始させます。
                        this.resetAttackerState(entityId, { interrupted: true });
                        continue; // このエンティティの以降の処理をスキップ
                    }
                }
            }
        }
    }
}
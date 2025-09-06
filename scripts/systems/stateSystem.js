/**
 * @file 状態管理システム
 * このファイルは、ゲーム内のすべてのエンティティの状態（GameState）を管理・更新する責務を持ちます。
 */

import { Gauge, GameState, Parts, PlayerInfo, Action, GameContext } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType } from '../constants.js';

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

        // なぜここでアクションの有効性を検証するのか？
        // 状態を遷移させる前の最終防衛ラインだからです。例えば、UIの不具合やAIの判断ミスで
        // 破壊されたパーツでの攻撃が選択された場合、この検証でブロックし、ゲームの不正な進行を防ぎます。
        const isActionValid = partKey && parts[partKey] && !parts[partKey].isBroken && 
                              targetId !== null && targetId !== undefined && 
                              targetPartKey !== null && targetPartKey !== undefined;

        if (!isActionValid) {
            console.warn(`StateSystem: Invalid action for entity ${entityId} was aborted. Re-queueing.`, detail);
            // アクションが無効だった場合、ペナルティなしで再選択させるため、TurnSystemに通知します。
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        // 1. 選択されたアクションの内容をActionコンポーネントに記録します。
        //    これにより、後のActionSystemが「何を実行すべきか」を知ることができます。
        action.partKey = partKey;
        action.type = parts[partKey].action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;

        // 2. エンティティの状態を「行動選択済みチャージ中」へ遷移させます。
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 3. ゲージをリセットし、行動実行までのチャージを開始させます。
        gauge.value = 0;
    }

    /**
     * ActionSystemによって行動が実行され、その結果が通知された際に呼び出されます。
     * @param {object} detail - 行動の実行結果
     */
    onActionExecuted(detail) {
        const { attackerId, targetId, targetPartKey, damage, isPartBroken, isPlayerBroken } = detail;

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

        // 4. 攻撃者の状態をリセットします。
        const attackerGameState = this.world.getComponent(attackerId, GameState);
        const attackerGauge = this.world.getComponent(attackerId, Gauge);
        const attackerAction = this.world.getComponent(attackerId, Action);

        // 状態を「チャージ中」（クールダウン）に戻し、次の行動に備えさせます。
        attackerGameState.state = PlayerStateType.CHARGING;
        attackerGauge.value = 0;
        
        // Actionコンポーネントをクリアし、前回の行動が残らないようにします。
        attackerAction.partKey = null;
        attackerAction.type = null;
        attackerAction.targetId = null;
        attackerAction.targetPartKey = null;
        attackerAction.damage = 0;
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
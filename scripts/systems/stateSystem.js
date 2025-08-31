// scripts/systems/stateSystem.js:

import { Gauge, GameState, Parts, PlayerInfo, Action, GameContext } from '../components.js'; // ★Attackを削除
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType, TeamID } from '../constants.js'; // ★TeamIDを追加

export class StateSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);

        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    onActionSelected(detail) {
        // ★変更: DecisionSystemのリファクタリングにより、このイベントには常に完全な情報(ターゲット含む)が含まれます。
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        // ★変更: アクションが完全に有効かどうかの検証を強化します。
        // 使用パーツ、ターゲット、ターゲットパーツがすべて有効でなければ、アクションを中止します。
        const isActionValid = partKey && parts[partKey] && !parts[partKey].isBroken && 
                              targetId !== null && targetId !== undefined && 
                              targetPartKey !== null && targetPartKey !== undefined;

        if (!isActionValid) {
            // アクションが無効な場合、コンソールに警告を出し、処理を中断します。
            // これにより、エンティティは現在の選択待ち状態に留まり、次の機会に行動を再試行します。
            console.warn(`StateSystem: Invalid action for entity ${entityId} was aborted.`, detail);
            return;
        }

        // 1. 決定された完全なアクションをActionコンポーネントに記録します。
        action.partKey = partKey;
        action.type = parts[partKey].action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;

        // 2. プレイヤーの状態を「選択後チャージ中」へ変更
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 3. ゲージをリセット
        gauge.value = 0;
    }

    onActionExecuted(detail) {
        const { attackerId, targetId, targetPartKey, damage, isPartBroken, isPlayerBroken } = detail;

        // 1. ダメージ適用と破壊判定
        const targetParts = this.world.getComponent(targetId, Parts);
        const part = targetParts[targetPartKey];
        part.hp = Math.max(0, part.hp - damage);

        // ★変更: isPartBrokenとisPlayerBrokenのイベント発行と状態変更をここに集約
        if (isPartBroken) {
            part.isBroken = true;
            this.world.emit(GameEvents.PART_BROKEN, { entityId: targetId, partKey: targetPartKey });
        }

        // プレイヤー（頭部）破壊の処理
        if (isPlayerBroken) {
            const gameState = this.world.getComponent(targetId, GameState);
            const gauge = this.world.getComponent(targetId, Gauge);
            // 状態を即座にBROKENに変更し、ゲージをリセット
            gameState.state = PlayerStateType.BROKEN;
            gauge.value = 0; 
            // PLAYER_BROKENイベントを発行し、GameFlowSystemにゲームオーバー判定を委ねる
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId: targetId });
        }

        // 2. 行動完了者の状態リセット
        const attackerGameState = this.world.getComponent(attackerId, GameState);
        const attackerGauge = this.world.getComponent(attackerId, Gauge);
        const attackerAction = this.world.getComponent(attackerId, Action);

        attackerGameState.state = PlayerStateType.CHARGING;
        attackerGauge.value = 0;
        // ★変更: Actionコンポーネントを完全にリセット
        attackerAction.partKey = null;
        attackerAction.type = null;
        attackerAction.targetId = null;
        attackerAction.targetPartKey = null;
        attackerAction.damage = 0;
    }

    

    update(deltaTime) {
        // ★変更: DecisionSystemの責務を一部移管。
        // このシステムが状態遷移の管理と、それに伴う行動決定のトリガー（イベント発行）を担う。
        const entities = this.world.getEntitiesWith(Gauge, GameState, Parts, PlayerInfo);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);

            // 1. ゲージ満タン時の状態遷移
            if (gauge.value >= gauge.max) {
                if (gameState.state === PlayerStateType.CHARGING) {
                    // チャージ完了 → クールダウン完了（行動選択可能）
                    gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
                } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                    // 選択後チャージ完了 → 実行準備完了
                    gameState.state = PlayerStateType.READY_EXECUTE;
                }
            }

            // 2. ★新規: 行動決定が必要なエンティティを検知し、イベントを発行する
            // 行動選択可能状態であり、かつ、まだ他のプレイヤーが行動選択中でない場合に実行
            const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
            if (selectableStates.includes(gameState.state) && this.context.activePlayer === null) {
                
                // 他のシステムが重複して処理しないよう、状態を更新しておく
                gameState.state = PlayerStateType.READY_SELECT;

                const playerInfo = this.world.getComponent(entityId, PlayerInfo);
                
                // チームIDに応じて、プレイヤー操作かAI操作かを判断し、適切なイベントを発行
                const eventToEmit = playerInfo.teamId === TeamID.TEAM1 
                    ? GameEvents.PLAYER_INPUT_REQUIRED 
                    : GameEvents.AI_ACTION_REQUIRED;
                
                this.world.emit(eventToEmit, { entityId });
            }
        }
    }
}

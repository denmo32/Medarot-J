// scripts/systems/stateSystem.js:

import { Gauge, GameState, Parts, PlayerInfo, Action, Attack, GameContext } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType } from '../constants.js';

export class StateSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    onActionSelected(detail) {
        const { entityId, partKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        // 1. 選択されたアクションとパーツを記録
        action.partKey = partKey;
        action.type = parts[partKey].action;
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
        const attackerAttack = this.world.getComponent(attackerId, Attack);

        attackerGameState.state = PlayerStateType.CHARGING;
        attackerGauge.value = 0;
        attackerAction.partKey = null;
        attackerAction.type = null;
        attackerAttack.target = null;
        attackerAttack.partKey = null;
        attackerAttack.damage = 0;
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(Gauge, GameState, Parts);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);
            const parts = this.world.getComponent(entityId, Parts);

            // ★削除: 頭部破壊のチェックはonActionExecutedに一本化されたため、ここでのチェックは不要になりました。
            // if (parts.head.isBroken && gameState.state !== PlayerStateType.BROKEN) { ... }

            // ゲージ満タン時の状態遷移
            if (gauge.value >= gauge.max) {
                if (gameState.state === PlayerStateType.CHARGING) {
                    // チャージ完了 → クールダウン完了（行動選択可能）
                    gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
                } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                    // 選択後チャージ完了 → 実行準備完了
                    gameState.state = PlayerStateType.READY_EXECUTE;
                }
            }
        }
    }
}

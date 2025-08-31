// scripts/systems/stateSystem.js:

import { Gauge, GameState, Parts, PlayerInfo, Action, GameContext, BattleLog } from '../components.js'; // ★Attackを削除
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType } from '../constants.js';

export class StateSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);

        this.world.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTED, this.onActionExecuted.bind(this));
    }

    onActionSelected(detail) {
        // ★変更: AIによる行動決定の場合、ターゲット情報もペイロードに含まれる
        const { entityId, partKey, targetId, targetPartKey } = detail;
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        // 念のため、行動不能なパーツが選択された場合は無視する
        if (!partKey || !parts[partKey] || parts[partKey].isBroken) {
            // 選択をキャンセルし、再度選択可能な状態に戻すなどの発展も考えられる
            return;
        }

        // 1. 選択されたアクション（使用パーツ）を記録
        action.partKey = partKey;
        action.type = parts[partKey].action;

        // 2. ★変更: AIによってターゲットが決定済みの場合は、Actionコンポーネントに保存
        // targetIdがnullの場合（ターゲットが見つからなかった）も考慮
        if (targetId !== undefined && targetPartKey !== undefined) {
            action.targetId = targetId;
            action.targetPartKey = targetPartKey;
        }

        // 3. プレイヤーの状態を「選択後チャージ中」へ変更
        gameState.state = PlayerStateType.SELECTED_CHARGING;
        
        // 4. ゲージをリセット
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

        // 3. 戦闘履歴を更新
        this.updateBattleLogs(attackerId, targetId, targetPartKey);
    }

    /**
     * 攻撃の実行結果に基づき、戦闘履歴を更新します。
     * @param {number} attackerId - 攻撃者のエンティティID
     * @param {number} targetId - ターゲットのエンティティID
     * @param {string} targetPartKey - ターゲットのパーツキー
     */
    updateBattleLogs(attackerId, targetId, targetPartKey) {
        // 攻撃者とターゲットの情報を取得
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerLog = this.world.getComponent(attackerId, BattleLog);
        const targetInfo = this.world.getComponent(targetId, PlayerInfo);
        const targetLog = this.world.getComponent(targetId, BattleLog);

        if (!attackerInfo || !attackerLog || !targetInfo || !targetLog) return;

        // 攻撃者のログを更新 (Focus性格用)
        attackerLog.lastAttack.targetId = targetId;
        attackerLog.lastAttack.partKey = targetPartKey;

        // ターゲットのログを更新 (Counter性格用)
        targetLog.lastAttackedBy = attackerId;

        // チームの最終攻撃情報を更新 (Assist性格用)
        this.context.teamLastAttack[attackerInfo.teamId] = {
            targetId: targetId,
            partKey: targetPartKey
        };

        // ターゲットがリーダーの場合、リーダーへの最終攻撃情報を更新 (Guard性格用)
        if (targetInfo.isLeader) {
            this.context.leaderLastAttackedBy[targetInfo.teamId] = attackerId;
        }
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

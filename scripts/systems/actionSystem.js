// scripts/systems/actionSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { GameState, PlayerInfo, Parts, Action, Attack, GamePhase, Gauge } from '../components.js';
import { PlayerStateType, PartType } from '../constants.js';
import { calculateDamage } from '../battleUtils.js';

export class ActionSystem {
    constructor(world) {
        this.world = world;
        // 提案1: UIからの直接呼び出しを避けるため、攻撃実行イベントをリッスンする
        document.addEventListener(GameEvents.EXECUTION_CONFIRMED, this.handleExecutionConfirmed.bind(this));
    }

    /**
     * 提案1: EXECUTION_CONFIRMED イベントを処理するハンドラ
     * @param {CustomEvent} event 
     */
    handleExecutionConfirmed(event) {
        const { entityId } = event.detail;
        this.applyDamage(entityId);
    }

    // プレイヤーからの確認に応じてダメージを適用する
    applyDamage(attackerId) {
        const attack = this.world.getComponent(attackerId, Attack);
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);

        if (!attack || !attack.target) {
            this.endAction(attackerId);
            return;
        }

        const { target, partKey, damage } = attack;
        const targetParts = this.world.getComponent(target, Parts);
        const targetPlayerInfo = this.world.getComponent(target, PlayerInfo);

        const part = targetParts[partKey];
        part.hp = Math.max(0, part.hp - damage);
        if (part.hp === 0) {
            part.isBroken = true;
            
            // 変更点：ゲームオーバー判定を削除し、代わりにパーツ破壊イベントを発行
            // これにより、このシステムの責務が「ダメージ計算と適用」に限定される
            document.dispatchEvent(new CustomEvent(GameEvents.PART_BROKEN, {
                detail: {
                    entityId: target,
                    partKey: partKey,
                    attackerId: attackerId,
                    isLeader: targetPlayerInfo.isLeader,
                    targetTeamId: targetPlayerInfo.teamId
                }
            }));
        }
        
        this.endAction(attackerId);
    }

    // 行動終了処理
    endAction(entityId) {
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);
        const action = this.world.getComponent(entityId, Action);
        const attack = this.world.getComponent(entityId, Attack);
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);

        gauge.value = 0;
        // 状態遷移を定数で行う
        gameState.state = PlayerStateType.CHARGING;
        action.partKey = null;
        action.type = null;
        attack.target = null;
        attack.partKey = null;
        attack.damage = 0;
        gamePhase.activePlayer = null;
    }

    update(deltaTime) {
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);
        if (gamePhase.activePlayer) return; // 誰かが行動選択中の場合は実行しない

        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.world.getComponent(id, GameState).state === PlayerStateType.READY_EXECUTE);

        if (executor) {
            const attackerInfo = this.world.getComponent(executor, PlayerInfo);
            const action = this.world.getComponent(executor, Action);
            const attack = this.world.getComponent(executor, Attack);

            const target = this.findEnemyTarget(executor);

            if (!target) {
                this.endAction(executor);
                return;
            }

            const targetParts = this.world.getComponent(target, Parts);
            const availableTargetParts = Object.keys(targetParts).filter(key => !targetParts[key].isBroken);

            if (availableTargetParts.length === 0) {
                this.endAction(executor);
                return;
            }

            const targetPartKey = availableTargetParts[Math.floor(Math.random() * availableTargetParts.length)];
            
            // 変更点：ダメージ計算を外部の battleUtils 関数に委譲
            const damage = calculateDamage(this.world, executor, target, action);

            attack.target = target;
            attack.partKey = targetPartKey;
            attack.damage = damage;

            gamePhase.activePlayer = executor;

            const modalData = {
                message: `${attackerInfo.name}の${action.type}！ ${this.world.getComponent(target, PlayerInfo).name}の${targetParts[targetPartKey].name}に${damage}ダメージ！`
            };
            document.dispatchEvent(new CustomEvent(GameEvents.SHOW_EXECUTION_MODAL, { detail: modalData }));
        }
    }

    findEnemyTarget(attackerId) {
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const enemies = this.world.getEntitiesWith(PlayerInfo, GameState)
            .filter(id => {
                if (id === attackerId) return false;
                const pInfo = this.world.getComponent(id, PlayerInfo);
                const gState = this.world.getComponent(id, GameState);
                return pInfo.teamId !== attackerInfo.teamId && gState.state !== PlayerStateType.BROKEN;
            });

        if (enemies.length === 0) return null;
        
        // リーダーを探す
        const leader = enemies.find(id => this.world.getComponent(id, PlayerInfo).isLeader);
        return leader || enemies[0];
    }
}
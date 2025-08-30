// scripts/systems/actionSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { GameState, PlayerInfo, Parts, Action, Attack, GameContext } from '../components.js';
import { PlayerStateType, PartType, TeamID } from '../constants.js';
import { calculateDamage } from '../battleUtils.js';

export class ActionSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.world.on(GameEvents.ACTION_EXECUTION_CONFIRMED, this.onActionExecutionConfirmed.bind(this));
    }

    onActionExecutionConfirmed(detail) {
        const { entityId } = detail;
        const attack = this.world.getComponent(entityId, Attack);

        if (!attack || attack.target === null || attack.target === undefined) {
            return;
        }
        
        const target = this.world.getComponent(attack.target, Parts);
        if (!target) {
            return;
        }

        // ダメージ計算はすでに行われているので、ここではイベントを発行するだけ
        const targetPart = target[attack.partKey];
        const newHp = Math.max(0, targetPart.hp - attack.damage);

        // StateSystemに行動の結果を通知する
        this.world.emit(GameEvents.ACTION_EXECUTED, {
            attackerId: entityId,
            targetId: attack.target,
            targetPartKey: attack.partKey,
            damage: attack.damage,
            isPartBroken: newHp === 0,
            isPlayerBroken: attack.partKey === PartType.HEAD && newHp === 0,
        });
    }

    update(deltaTime) {
        // ★変更: isPaused()で、他の処理が実行中でないかを確認
        if (this.context.isPaused()) return;

        // 実行準備が完了しているプレイヤーを探す
        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.world.getComponent(id, GameState).state === PlayerStateType.READY_EXECUTE);

        if (executor !== undefined && executor !== null) {
            const action = this.world.getComponent(executor, Action);
            const attack = this.world.getComponent(executor, Attack);

            // 1. 攻撃対象を見つける
            const targetId = this.findEnemyTarget(executor);
            if (targetId === null) {
                // ターゲットがいない場合は行動をスキップして完了させる
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: executor });
                return;
            }

            // 2. 攻撃対象のパーツを決める
            const targetParts = this.world.getComponent(targetId, Parts);
            const availableTargetParts = Object.keys(targetParts).filter(key => !targetParts[key].isBroken && key !== PartType.LEGS);

            if (availableTargetParts.length === 0) {
                // 攻撃可能なパーツがない場合も行動をスキップ
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: executor });
                return;
            }
            const targetPartKey = availableTargetParts[Math.floor(Math.random() * availableTargetParts.length)];
            
            // 3. ダメージを計算し、Attackコンポーネントに記録
            const damage = calculateDamage(this.world, executor, targetId, action);
            attack.target = targetId;
            attack.partKey = targetPartKey;
            attack.damage = damage;

            // 4. 攻撃実行モーダルの表示を要求
            const attackerInfo = this.world.getComponent(executor, PlayerInfo);
            const targetInfo = this.world.getComponent(targetId, PlayerInfo);
            this.world.emit(GameEvents.SHOW_MODAL, {
                type: 'execution',
                data: {
                    entityId: executor, // 誰が実行したか
                    message: `${attackerInfo.name}の${action.type}！ ${targetInfo.name}の${targetParts[targetPartKey].name}に${damage}ダメージ！`
                }
            });
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
        
        // リーダーがいたら優先的に狙う
        const leader = enemies.find(id => this.world.getComponent(id, PlayerInfo).isLeader);
        return leader || enemies[0];
    }
}
// scripts/systems/actionSystem.js:

import { CONFIG } from '../config.js';
import { GameEvents } from '../events.js';
import { GameState, PlayerInfo, Parts, Action, Attack, GameContext, Medal, BattleLog } from '../components.js';
import { PlayerStateType, PartType, TeamID, MedalPersonality } from '../constants.js';
import { calculateDamage } from '../battleUtils.js';

export class ActionSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);

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
        if (this.context.isPaused()) return;

        const executor = this.world.getEntitiesWith(GameState)
            .find(id => this.world.getComponent(id, GameState).state === PlayerStateType.READY_EXECUTE);

        if (executor === undefined || executor === null) return;

        const action = this.world.getComponent(executor, Action);
        const attack = this.world.getComponent(executor, Attack);

        // --- ターゲット決定処理 ---
        // ★変更: Attackコンポーネントにターゲットが未設定の場合（＝プレイヤーの行動）のみ、ここでターゲットを決定します。
        // AIの場合はDecisionSystemで事前にターゲットが決定され、Attackコンポーネントに保存されています。
        if (attack.target === null || attack.target === undefined) {
            const target = this.determineTarget(executor);
            if (!target) {
                // ターゲットが見つからない場合は行動をスキップして完了させます。
                this.world.emit(GameEvents.ACTION_EXECUTION_CONFIRMED, { entityId: executor });
                return;
            }
            // 決定したターゲットをAttackコンポーネントに設定します。
            attack.target = target.targetId;
            attack.partKey = target.targetPartKey;
        }

        // --- ダメージ計算 ---
        // これで全実行者のターゲット情報が確定したので、ダメージを計算します。
        const damage = calculateDamage(this.world, executor, attack.target, action);
        attack.damage = damage;

        // --- 攻撃実行モーダルの表示要求 ---
        const attackerInfo = this.world.getComponent(executor, PlayerInfo);
        const targetInfo = this.world.getComponent(attack.target, PlayerInfo);
        const targetParts = this.world.getComponent(attack.target, Parts);
        this.world.emit(GameEvents.SHOW_MODAL, {
            type: 'execution',
            data: {
                entityId: executor,
                message: `${attackerInfo.name}の${action.type}！ ${targetInfo.name}の${targetParts[attack.partKey].name}に${damage}ダメージ！`
            }
        });
    }

    /**
     * 攻撃者のメダルの性格に基づき、ターゲット（敵エンティティとパーツ）を決定します。
     * @param {number} attackerId - 攻撃者のエンティティID
     * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報、またはnull
     */
    determineTarget(attackerId) {
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerMedal = this.world.getComponent(attackerId, Medal);
        const attackerLog = this.world.getComponent(attackerId, BattleLog);

        const enemies = this.getValidEnemies(attackerId);
        if (enemies.length === 0) return null;

        let targetId = null;
        let targetPartKey = null;

        // 性格に基づいてターゲットを決定
        switch (attackerMedal.personality) {
            case MedalPersonality.HUNTER:
            case MedalPersonality.CRUSHER: {
                const allParts = this.getAllEnemyParts(enemies);
                if (allParts.length === 0) break;
                allParts.sort((a, b) => a.part.hp - b.part.hp); // HPで昇順ソート
                const targetPartInfo = attackerMedal.personality === MedalPersonality.HUNTER ? allParts[0] : allParts[allParts.length - 1];
                targetId = targetPartInfo.entityId;
                targetPartKey = targetPartInfo.partKey;
                break;
            }
            case MedalPersonality.JOKER: {
                 const allParts = this.getAllEnemyParts(enemies);
                 if (allParts.length === 0) break;
                 const randomPart = allParts[Math.floor(Math.random() * allParts.length)];
                 targetId = randomPart.entityId;
                 targetPartKey = randomPart.partKey;
                 break;
            }
            case MedalPersonality.COUNTER: {
                const lastAttackerId = attackerLog.lastAttackedBy;
                if (this.isValidTarget(lastAttackerId)) {
                    targetId = lastAttackerId;
                }
                break;
            }
            case MedalPersonality.GUARD: {
                const leaderLastAttackerId = this.context.leaderLastAttackedBy[attackerInfo.teamId];
                if (this.isValidTarget(leaderLastAttackerId)) {
                    targetId = leaderLastAttackerId;
                }
                break;
            }
            case MedalPersonality.FOCUS: {
                const lastAttack = attackerLog.lastAttack;
                if (this.isValidTarget(lastAttack.targetId, lastAttack.partKey)) {
                    targetId = lastAttack.targetId;
                    targetPartKey = lastAttack.partKey;
                }
                break;
            }
            case MedalPersonality.ASSIST: {
                const teamLastAttack = this.context.teamLastAttack[attackerInfo.teamId];
                if (this.isValidTarget(teamLastAttack.targetId, teamLastAttack.partKey)) {
                    targetId = teamLastAttack.targetId;
                    targetPartKey = teamLastAttack.partKey;
                }
                break;
            }
            case MedalPersonality.LEADER_FOCUS: {
                const leader = enemies.find(id => this.world.getComponent(id, PlayerInfo).isLeader);
                if (this.isValidTarget(leader)) {
                    targetId = leader;
                }
                break;
            }
            case MedalPersonality.RANDOM:
            default:
                // デフォルトの動作（ランダムな敵）
                break;
        }

        // フォールバック処理: ターゲットエンティティが決まらなかった場合、ランダムな敵を選択します。
        if (!this.isValidTarget(targetId)) {
            targetId = enemies[Math.floor(Math.random() * enemies.length)];
        }

        // フォールバック処理: ターゲットパーツが決まっていない、または無効な場合、有効なパーツからランダムに選択します。
        if (!targetPartKey || !this.isValidTarget(targetId, targetPartKey)) {
            const availableParts = this.getAvailableParts(targetId);
            if (availableParts.length > 0) {
                targetPartKey = availableParts[Math.floor(Math.random() * availableParts.length)];
            } else {
                // 選択したターゲットに攻撃可能なパーツがない場合、ターゲット選択からやり直すか、行動をスキップします。
                // ここでは簡単のため、一旦nullを返して行動をスキップさせます。
                // TODO: 攻撃可能なパーツを持つ別の敵を探すロジックも検討可能です。
                return null;
            }
        }
        
        return { targetId, targetPartKey };
    }

    // --- ターゲット選択のヘルパーメソッド群 ---

    /** 生存している敵エンティティのリストを取得します */
    getValidEnemies(attackerId) {
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        return this.world.getEntitiesWith(PlayerInfo, GameState)
            .filter(id => {
                const pInfo = this.world.getComponent(id, PlayerInfo);
                const gState = this.world.getComponent(id, GameState);
                return id !== attackerId && pInfo.teamId !== attackerInfo.teamId && gState.state !== PlayerStateType.BROKEN;
            });
    }

    /** 指定された敵たちの、破壊されていない全パーツのリストを取得します */
    getAllEnemyParts(enemyIds) {
        let allParts = [];
        for (const id of enemyIds) {
            const parts = this.world.getComponent(id, Parts);
            Object.entries(parts).forEach(([key, part]) => {
                if (!part.isBroken && key !== PartType.LEGS) {
                    allParts.push({ entityId: id, partKey: key, part: part });
                }
            });
        }
        return allParts;
    }

    /** 指定されたエンティティの、破壊されていないパーツキーのリストを取得します */
    getAvailableParts(entityId) {
        if (entityId === null || entityId === undefined) return [];
        const parts = this.world.getComponent(entityId, Parts);
        if (!parts) return [];
        return Object.keys(parts).filter(key => !parts[key].isBroken && key !== PartType.LEGS);
    }

    /** 指定されたターゲットIDやパーツキーが現在有効（生存・未破壊）か検証します */
    isValidTarget(targetId, partKey = null) {
        if (targetId === null || targetId === undefined) return false;

        const gameState = this.world.getComponent(targetId, GameState);
        if (!gameState || gameState.state === PlayerStateType.BROKEN) return false;

        if (partKey) {
            const parts = this.world.getComponent(targetId, Parts);
            if (!parts || !parts[partKey] || parts[partKey].isBroken) {
                return false;
            }
        }
        return true;
    }
}
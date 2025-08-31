// scripts/systems/decisionSystem.js:

import { PlayerInfo, GameState, Parts, GameContext, Medal, BattleLog } from '../components.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID, MedalPersonality } from '../constants.js';
import { GameEvents } from '../events.js';

/**
 * プレイヤーまたはAIの行動選択を管理し、ターゲットを決定するシステム。
 * InputSystemとAiSystemの機能を統合し、ターゲット決定ロジックも集約しています。
 */
export class DecisionSystem {
    /**
     * @param {World} world - ワールドオブジェクト
     * @param {string} teamId - 担当するチームID (TeamID.TEAM1 or TeamID.TEAM2)
     * @param {string} type - 'player' または 'ai'
     */
    constructor(world, teamId, type) {
        this.world = world;
        this.teamId = teamId;
        this.type = type; // 'player' or 'ai'

        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);

        this._bindEvents();
    }

    /**
     * システムの種類に応じて、適切なイベントリスナーを登録します。
     * @private
     */
    _bindEvents() {
        if (this.type === 'player') {
            this.world.on(GameEvents.PLAYER_INPUT_REQUIRED, this._handlePlayerInput.bind(this));
        } else {
            this.world.on(GameEvents.AI_ACTION_REQUIRED, this._handleAiAction.bind(this));
        }
    }

    /**
     * 担当チームの中から、行動選択が必要なエンティティを探してイベントを発行します。
     */
    update(deltaTime) {
        const activePhases = [GamePhaseType.INITIAL_SELECTION, GamePhaseType.BATTLE];
        if (this.context.isPaused() || !activePhases.includes(this.context.phase)) {
            return;
        }

        // 担当チームの中で行動選択可能なエンティティを探す
        const selectableEntity = this.world.getEntitiesWith(PlayerInfo, GameState)
            .find(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                const gameState = this.world.getComponent(id, GameState);
                if (!playerInfo || !gameState) return false;

                const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                return playerInfo.teamId === this.teamId && selectableStates.includes(gameState.state);
            });

        if (selectableEntity !== undefined && selectableEntity !== null) {
            const gameState = this.world.getComponent(selectableEntity, GameState);
            // 状態を確定させ、他のシステムが重複して処理しないようにする
            gameState.state = PlayerStateType.READY_SELECT;

            // タイプに応じて適切なイベントを発行
            const eventToEmit = this.type === 'player' ? GameEvents.PLAYER_INPUT_REQUIRED : GameEvents.AI_ACTION_REQUIRED;
            this.world.emit(eventToEmit, { entityId: selectableEntity });
        }
    }

    // --- イベントハンドラ ---

    /**
     * プレイヤーの行動選択UI（モーダル）の表示を要求します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     * @private
     */
    _handlePlayerInput(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const parts = this.world.getComponent(entityId, Parts);
        
        const attackableParts = [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM];
        const availableParts = Object.entries(parts)
            .filter(([key, part]) => !part.isBroken && attackableParts.includes(key));
        
        // UIシステムにモーダル表示を要求
        const modalData = {
            entityId: entityId,
            title: '行動選択',
            actorName: `${playerInfo.name} の番です。`,
            buttons: availableParts.map(([partKey, part]) => ({
                text: `${part.name} (${part.action})`,
                partKey: partKey
                // プレイヤーのターゲット選択は未実装のため、ここではpartKeyのみ
            }))
        };
        this.world.emit(GameEvents.SHOW_MODAL, { type: 'selection', data: modalData });
    }

    /**
     * AIの行動（使用パーツとターゲット）を決定し、結果をイベントで通知します。
     * @param {object} detail - イベントの詳細 ({ entityId })
     * @private
     */
    _handleAiAction(detail) {
        const { entityId } = detail;
        const parts = this.world.getComponent(entityId, Parts);

        const availableParts = Object.entries(parts)
            .filter(([key, part]) => !part.isBroken && [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM].includes(key));

        if (availableParts.length > 0) {
            // 1. どのパーツで攻撃するかを選択
            const [partKey, part] = this._chooseActionPart(entityId, availableParts);
            
            // 2. 誰のどのパーツを攻撃するかを決定
            const target = this._determineTarget(entityId);
            if (!target) {
                // ターゲットが見つからない場合は行動をスキップ
                 this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey: null, targetId: null, targetPartKey: null });
                return;
            }
            const { targetId, targetPartKey } = target;

            // 3. 決定した行動内容を通知する
            this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey, targetId, targetPartKey });

        } else {
            // 攻撃パーツがない場合
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    // --- AIの思考ロジック ---

    /**
     * AIが使用する攻撃パーツを選択します。（旧AiSystem.chooseAction）
     * @param {number} entityId - AIのエンティティID
     * @param {Array} availableParts - 使用可能なパーツのリスト
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト
     * @private
     */
    _chooseActionPart(entityId, availableParts) {
        // 利用可能なパーツの中で最も攻撃力が高いものを選択する
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }
        const sortedParts = [...availableParts].sort(([, partA], [, partB]) => partB.power - partA.power);
        return sortedParts[0];
    }

    /**
     * 攻撃者のメダルの性格に基づき、ターゲットを決定します。（旧ActionSystem.determineTarget）
     * @param {number} attackerId - 攻撃者のエンティティID
     * @returns {{targetId: number, targetPartKey: string} | null} ターゲット情報
     * @private
     */
    _determineTarget(attackerId) {
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        const attackerMedal = this.world.getComponent(attackerId, Medal);
        const attackerLog = this.world.getComponent(attackerId, BattleLog);

        const enemies = this._getValidEnemies(attackerId);
        if (enemies.length === 0) return null;

        let targetId = null;
        let targetPartKey = null;

        switch (attackerMedal.personality) {
            case MedalPersonality.HUNTER:
            case MedalPersonality.CRUSHER: {
                const allParts = this._getAllEnemyParts(enemies);
                if (allParts.length === 0) break;
                allParts.sort((a, b) => a.part.hp - b.part.hp);
                const targetPartInfo = attackerMedal.personality === MedalPersonality.HUNTER ? allParts[0] : allParts[allParts.length - 1];
                targetId = targetPartInfo.entityId;
                targetPartKey = targetPartInfo.partKey;
                break;
            }
            case MedalPersonality.JOKER: {
                 const allParts = this._getAllEnemyParts(enemies);
                 if (allParts.length === 0) break;
                 const randomPart = allParts[Math.floor(Math.random() * allParts.length)];
                 targetId = randomPart.entityId;
                 targetPartKey = randomPart.partKey;
                 break;
            }
            case MedalPersonality.COUNTER:
                if (this._isValidTarget(attackerLog.lastAttackedBy)) {
                    targetId = attackerLog.lastAttackedBy;
                }
                break;
            case MedalPersonality.GUARD:
                const leaderLastAttackerId = this.context.leaderLastAttackedBy[attackerInfo.teamId];
                if (this._isValidTarget(leaderLastAttackerId)) {
                    targetId = leaderLastAttackerId;
                }
                break;
            case MedalPersonality.FOCUS:
                const lastAttack = attackerLog.lastAttack;
                if (this._isValidTarget(lastAttack.targetId, lastAttack.partKey)) {
                    targetId = lastAttack.targetId;
                    targetPartKey = lastAttack.partKey;
                }
                break;
            case MedalPersonality.ASSIST:
                const teamLastAttack = this.context.teamLastAttack[attackerInfo.teamId];
                if (this._isValidTarget(teamLastAttack.targetId, teamLastAttack.partKey)) {
                    targetId = teamLastAttack.targetId;
                    targetPartKey = teamLastAttack.partKey;
                }
                break;
            case MedalPersonality.LEADER_FOCUS:
                const leader = enemies.find(id => this.world.getComponent(id, PlayerInfo).isLeader);
                if (this._isValidTarget(leader)) {
                    targetId = leader;
                }
                break;
            case MedalPersonality.RANDOM:
            default:
                break;
        }

        if (!this._isValidTarget(targetId)) {
            targetId = enemies[Math.floor(Math.random() * enemies.length)];
        }

        if (!targetPartKey || !this._isValidTarget(targetId, targetPartKey)) {
            const availableParts = this._getAvailableParts(targetId);
            if (availableParts.length > 0) {
                targetPartKey = availableParts[Math.floor(Math.random() * availableParts.length)];
            } else {
                return null;
            }
        }
        
        return { targetId, targetPartKey };
    }

    // --- ターゲット選択のヘルパーメソッド群 ---

    _getValidEnemies(attackerId) {
        const attackerInfo = this.world.getComponent(attackerId, PlayerInfo);
        return this.world.getEntitiesWith(PlayerInfo, GameState)
            .filter(id => {
                const pInfo = this.world.getComponent(id, PlayerInfo);
                const gState = this.world.getComponent(id, GameState);
                return id !== attackerId && pInfo.teamId !== attackerInfo.teamId && gState.state !== PlayerStateType.BROKEN;
            });
    }

    _getAllEnemyParts(enemyIds) {
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

    _getAvailableParts(entityId) {
        if (entityId === null || entityId === undefined) return [];
        const parts = this.world.getComponent(entityId, Parts);
        if (!parts) return [];
        return Object.keys(parts).filter(key => !parts[key].isBroken && key !== PartType.LEGS);
    }

    _isValidTarget(targetId, partKey = null) {
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

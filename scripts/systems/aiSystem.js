// scripts/systems/aiSystem.js:

import { PlayerInfo, GameState, Parts, Action, GameContext } from '../components.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID } from '../constants.js';
import { GameEvents } from '../events.js';

export class AiSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.world.on(GameEvents.AI_ACTION_REQUIRED, this.onAiActionRequired.bind(this));
    }

    onAiActionRequired(detail) {
        const { entityId } = detail;
        const parts = this.world.getComponent(entityId, Parts);

        // 攻撃に使えるパーツ（頭、右腕、左腕）をフィルタリング
        const availableParts = Object.entries(parts)
            .filter(([key, part]) => !part.isBroken && [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM].includes(key));

        if (availableParts.length > 0) {
            // どのパーツで攻撃するかを選択
            const [partKey, part] = this.chooseAction(entityId, availableParts);
            // StateSystemに行動選択を通知する
            this.world.emit(GameEvents.ACTION_SELECTED, { entityId, partKey });
        } else {
            // 攻撃パーツがない場合、StateSystemに状態変更を委ねるためBROKENイベントを発行
            // (StateSystem側で頭部破壊時にBROKENになる処理があるが、念のため)
            this.world.emit(GameEvents.PLAYER_BROKEN, { entityId });
        }
    }

    /**
     * AIの行動選択ロジック
     * @param {number} entityId - AIのエンティティID
     * @param {Array} availableParts - 使用可能なパーツのリスト
     * @returns {[string, object]} - 選択されたパーツのキーとオブジェクト
     */
    chooseAction(entityId, availableParts) {
        // 利用可能なパーツの中で最も攻撃力が高いものを選択する
        if (!availableParts || availableParts.length === 0) {
            return [null, null];
        }

        // powerで降順にソートして、最初の要素（最もpowerが高い）を選ぶ
        const sortedParts = [...availableParts].sort(([, partA], [, partB]) => partB.power - partA.power);
        
        return sortedParts[0];
    }

    update(deltaTime) {
        // ★変更: isPaused()で、他の処理が実行中でないかを確認
        const activePhases = [GamePhaseType.INITIAL_SELECTION, GamePhaseType.BATTLE];
        if (this.context.isPaused() || !activePhases.includes(this.context.phase)) {
            return;
        }

        // チーム2の中で行動選択可能なCPUプレイヤーを探す
        const cpuEntities = this.world.getEntitiesWith(PlayerInfo, GameState)
            .filter(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                const gameState = this.world.getComponent(id, GameState);
                const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                // チームIDが2で、かつ選択可能な状態のプレイヤー
                return playerInfo.teamId === TeamID.TEAM2 && selectableStates.includes(gameState.state);
            });

        // 対象のCPUに行動を要求する
        for (const entityId of cpuEntities) {
            const gameState = this.world.getComponent(entityId, GameState);
            // 状態を確定させる（クールダウン完了から選択準備完了へ）
            gameState.state = PlayerStateType.READY_SELECT;
            
            // このAIに行動を要求するイベントを発行
            this.world.emit(GameEvents.AI_ACTION_REQUIRED, { entityId });
        }
    }
}

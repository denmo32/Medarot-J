// scripts/systems/inputSystem.js:

import { PlayerInfo, GameState, Parts, GameContext } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType, TeamID } from '../constants.js';

export class InputSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);

        this.world.on(GameEvents.PLAYER_INPUT_REQUIRED, this.onPlayerInputRequired.bind(this));
    }

    onPlayerInputRequired(detail) {
        const { entityId } = detail;
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const parts = this.world.getComponent(entityId, Parts);
        
        // 攻撃に使用可能なパーツ（頭、右腕、左腕）をフィルタリング
        const attackableParts = [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM];
        const availableParts = Object.entries(parts)
            .filter(([key, part]) => !part.isBroken && attackableParts.includes(key));
        
        // モーダル表示に必要なデータを準備して、UIシステムに表示を要求
        const modalData = {
            entityId: entityId,
            title: '行動選択',
            actorName: `${playerInfo.name} の番です。`,
            buttons: availableParts.map(([partKey, part]) => ({
                text: `${part.name} (${part.action})`,
                partKey: partKey
            }))
        };

        this.world.emit(GameEvents.SHOW_MODAL, { type: 'selection', data: modalData });
    }

    update(deltaTime) {
        // ★変更: isPaused()で、他の処理が実行中でないかを確認
        const activePhases = [GamePhaseType.INITIAL_SELECTION, GamePhaseType.BATTLE];
        if (this.context.isPaused() || !activePhases.includes(this.context.phase)) {
            return;
        }

        // チーム1の中で行動選択可能なプレイヤーを探す
        const selectablePlayer = this.world.getEntitiesWith(PlayerInfo, GameState)
            .find(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                const gameState = this.world.getComponent(id, GameState);
                
                if (!playerInfo || !gameState) return false;

                const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                // チームIDが1で、かつ選択可能な状態のプレイヤー
                return playerInfo.teamId === TeamID.TEAM1 && selectableStates.includes(gameState.state);
            });

        // ★★★ 不具合修正：selectablePlayerが0の場合もtrueになるように修正 ★★★
        if (selectablePlayer !== undefined && selectablePlayer !== null) {
            const gameState = this.world.getComponent(selectablePlayer, GameState);
            // 状態を確定させる（クールダウン完了から選択準備完了へ）
            gameState.state = PlayerStateType.READY_SELECT;

            // プレイヤーに入力を要求するイベントを発行
            this.world.emit(GameEvents.PLAYER_INPUT_REQUIRED, { entityId: selectablePlayer });
        }
    }
}
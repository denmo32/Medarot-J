// scripts/systems/inputSystem.js:

import { PlayerInfo, GameState, GamePhase, Parts } from '../components.js'; // 提案3: Partsコンポーネントをインポート
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType } from '../constants.js'; // 提案3: PartTypeをインポート

export class InputSystem {
    constructor(world) {
        this.world = world;
    }

    update(deltaTime) {
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);

        // 比較を定数に変更
        const activePhases = [GamePhaseType.INITIAL_SELECTION, GamePhaseType.BATTLE];
        // 誰かが行動中、またはモーダル表示中、またはバトル中でない場合は何もしない
        if (gamePhase.activePlayer || gamePhase.showModal || !activePhases.includes(gamePhase.phase)) {
            return;
        }

        // 行動選択可能なプレイヤーを探す (team1のみ)
        const selectablePlayer = this.world.getEntitiesWith(PlayerInfo, GameState)
            .find(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                const gameState = this.world.getComponent(id, GameState);
                // 比較を定数に変更
                const selectableStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
                return playerInfo.teamId === 'team1' && selectableStates.includes(gameState.state);
            });

        if (selectablePlayer) {
            // 他のシステムが動作しないように activePlayer を設定する
            const gameState = this.world.getComponent(selectablePlayer, GameState);
            // 状態を正規化（定数を使用）
            gameState.state = PlayerStateType.READY_SELECT;

            gamePhase.activePlayer = selectablePlayer;

            // 提案3: モーダル表示のためのデータをここで生成する
            const playerInfo = this.world.getComponent(selectablePlayer, PlayerInfo);
            const parts = this.world.getComponent(selectablePlayer, Parts);
            const attackableParts = [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM];
            const availableParts = Object.entries(parts)
                .filter(([key, part]) => !part.isBroken && attackableParts.includes(key));
            
            const modalData = {
                entityId: selectablePlayer,
                title: '行動選択',
                actorName: `${playerInfo.name} の番です。`,
                // UiSystemが必要とするボタンの情報を配列として生成する
                buttons: availableParts.map(([partKey, part]) => ({
                    text: `${part.name} (${part.action})`,
                    partKey: partKey
                }))
            };
            
            // モーダル表示のためのイベントを発行 (UiSystemはmodalDataを受け取って描画に専念する)
            document.dispatchEvent(new CustomEvent(GameEvents.SHOW_SELECTION_MODAL, { detail: modalData }));
        }
    }
}
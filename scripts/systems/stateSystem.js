// scripts/systems/stateSystem.js:

import { Gauge, GameState, Parts, GamePhase, PlayerInfo } from '../components.js';
import { GameEvents } from '../events.js';
import { PlayerStateType, GamePhaseType, PartType } from '../constants.js';

export class StateSystem {
    constructor(world) {
        this.world = world;
        // 新規追加：パーツ破壊イベントを監視するためのリスナーを登録
        document.addEventListener(GameEvents.PART_BROKEN, this.handlePartBroken.bind(this));
    }

    /**
     * 新規追加：パーツ破壊イベントを処理するハンドラ
     * ゲームのルール（勝敗判定）に関する責務をこのシステムに集約
     * @param {CustomEvent} event - partBrokenイベント
     */
    handlePartBroken(event) {
        const { entityId, partKey, isLeader, attackerId } = event.detail;

        // リーダーの頭部が破壊された場合、ゲームオーバー処理を行う
        if (partKey === PartType.HEAD && isLeader) {
            const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
            const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);
            
            // 既にゲームオーバーなら何もしない
            if (gamePhase.phase === GamePhaseType.GAME_OVER) return;

            gamePhase.phase = GamePhaseType.GAME_OVER;
            
            // 攻撃者の情報から勝利チームを特定する
            const winningTeam = this.world.getComponent(attackerId, PlayerInfo).teamId;

            // UIシステムにゲームオーバーモーダルの表示を依頼する
            const eventData = { winningTeam: winningTeam };
            document.dispatchEvent(new CustomEvent(GameEvents.SHOW_GAME_OVER_MODAL, { detail: eventData }));
        }
    }

    update(deltaTime) {
        const entities = this.world.getEntitiesWith(Gauge, GameState, Parts);
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);
            const parts = this.world.getComponent(entityId, Parts);

            // 頭部が破壊されていたら、stateを'broken'に強制変更
            if (parts.head.isBroken && gameState.state !== PlayerStateType.BROKEN) {
                gameState.state = PlayerStateType.BROKEN;
                gauge.value = 0;
                continue; // このフレームでは以降の判定は不要
            }

            // ゲージが最大に達した場合の状態遷移
            if (gauge.value >= gauge.max) {
                if (gameState.state === PlayerStateType.CHARGING) {
                    gameState.state = PlayerStateType.COOLDOWN_COMPLETE;
                } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
                    gameState.state = PlayerStateType.READY_EXECUTE;
                }
            }
        }

        // 全員の行動選択が終わったら、戦闘開始確認フェーズへ
        if (gamePhase.phase === GamePhaseType.INITIAL_SELECTION) {
            const allPlayers = this.world.getEntitiesWith(GameState);
            const allSelected = allPlayers.every(id => {
                const state = this.world.getComponent(id, GameState);
                return state.state !== PlayerStateType.READY_SELECT && state.state !== PlayerStateType.COOLDOWN_COMPLETE;
            });

            if (allSelected) {
                gamePhase.phase = GamePhaseType.BATTLE_START_CONFIRM;
                document.dispatchEvent(new CustomEvent(GameEvents.SHOW_BATTLE_START_MODAL));
            }
        }
    }
}
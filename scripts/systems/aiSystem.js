// scripts/systems/aiSystem.js:

import { PlayerInfo, GameState, Parts, Action, GamePhase, Gauge } from '../components.js';
import { PlayerStateType, PartType } from '../constants.js';

export class AiSystem {
    constructor(world) {
        this.world = world;
    }

    /**
     * 新規追加：AIの行動選択ロジックを分離
     * @param {number} entityId - AIのエンティティID
     * @param {Array} availableParts - 攻撃に使用可能なパーツのリスト
     * @returns {[string, object]} - 選択された [partKey, partObject]
     */
    chooseAction(entityId, availableParts) {
        // TODO: もう少し賢いロジックにする
        // 例：リーダーを優先的に狙う、HPの低い敵を狙う、など
        // 現在は、とりあえず最初の有効なパーツで攻撃する
        return availableParts[0];
    }

    update(deltaTime) {
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);
        if (gamePhase.activePlayer) return; // プレイヤーが入力中の場合はCPUは思考しない

        const cpuEntities = this.world.getEntitiesWith(PlayerInfo, GameState, Parts, Action)
            .filter(id => {
                const playerInfo = this.world.getComponent(id, PlayerInfo);
                return playerInfo.teamId === 'team2';
            });

        for (const entityId of cpuEntities) {
            const gameState = this.world.getComponent(entityId, GameState);

            if (gameState.state === PlayerStateType.READY_SELECT || gameState.state === PlayerStateType.COOLDOWN_COMPLETE) {
                const parts = this.world.getComponent(entityId, Parts);
                const action = this.world.getComponent(entityId, Action);
                const gauge = this.world.getComponent(entityId, Gauge);

                // 定数を使用して攻撃可能なパーツをフィルタリング
                const availableParts = Object.entries(parts)
                    .filter(([key, part]) => !part.isBroken && [PartType.HEAD, PartType.RIGHT_ARM, PartType.LEFT_ARM].includes(key));

                if (availableParts.length > 0) {
                    // 変更点：行動選択ロジックを専用メソッドに委譲
                    const [partKey, part] = this.chooseAction(entityId, availableParts);

                    action.partKey = partKey;
                    action.type = part.action;
                    gameState.state = PlayerStateType.SELECTED_CHARGING;
                    gauge.value = 0;
                } else {
                    // 攻撃パーツがない場合
                    gameState.state = PlayerStateType.BROKEN;
                }
            }
        }
    }
}
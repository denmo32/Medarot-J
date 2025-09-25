import { BaseSystem } from '../../core/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG, PLAYER_STATES, MAP_EVENTS, TILE_TYPES } from '../constants.js';

/**
 * エンティティの位置を目標地点に向かって更新するシステム。
 */
export class MovementSystem extends BaseSystem {
    constructor(world, map) {
        super(world);
        this.map = map;
    }

    /**
     * @param {number} deltaTime - 前フレームからの経過時間
     */
    update(deltaTime) {
        const entities = this.world.getEntitiesWith(
            MapComponents.Position, 
            MapComponents.State, 
            MapComponents.TargetPosition
        );
        const speed = CONFIG.PLAYER_SPEED_PPS; // TODO: 将来的にはSpeedコンポーネントから取得

        for (const entityId of entities) {
            const position = this.world.getComponent(entityId, MapComponents.Position);
            const state = this.world.getComponent(entityId, MapComponents.State);
            const targetPosition = this.world.getComponent(entityId, MapComponents.TargetPosition);

            if (state.value !== PLAYER_STATES.WALKING || !targetPosition) {
                continue;
            }

            const moveAmount = speed * (deltaTime / 1000);

            // 目標地点までの距離
            const dx = targetPosition.x - position.x;
            const dy = targetPosition.y - position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= moveAmount) {
                // 目標地点に到達または超えた場合
                position.x = targetPosition.x;
                position.y = targetPosition.y;
                state.value = PLAYER_STATES.IDLE;
                this.world.removeComponent(entityId, MapComponents.TargetPosition);

                // ★新規: 戦闘トリガータイルに到達したかチェック
                const tileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
                const tileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
                const currentTileType = this.map.getTileType(tileX, tileY);

                if (currentTileType === TILE_TYPES.BATTLE_TRIGGER) {
                    this.world.emit(MAP_EVENTS.BATTLE_TRIGGERED);
                }

            } else {
                // 目標地点に向かって移動
                position.x += (dx / distance) * moveAmount;
                position.y += (dy / distance) * moveAmount;
            }
        }
    }
}

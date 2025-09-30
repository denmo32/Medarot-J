import { BaseSystem } from '../../core/baseSystem.js';
import * as MapComponents from '../components.js';
import { CONFIG, PLAYER_STATES } from '../constants.js';
import { UIStateContext } from '../../battle/core/UIStateContext.js';

/**
 * プレイヤーの入力に基づいて目標タイルを設定し、状態を遷移させるシステム。
 */
export class PlayerInputSystem extends BaseSystem {
    constructor(world, input, map) {
        super(world);
        this.input = input;
        this.map = map;
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);
    }

    update() {
        if (this.uiStateContext && this.uiStateContext.isPausedByModal) {
            return;
        }

        const entities = this.world.getEntitiesWith(
            MapComponents.PlayerControllable, 
            MapComponents.State, 
            MapComponents.Position,
            MapComponents.Collision
        );

        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, MapComponents.State);

            // アイドル状態かつ入力がある場合のみ処理
            if (state.value === PLAYER_STATES.IDLE && this.input && this.input.direction) {
                const position = this.world.getComponent(entityId, MapComponents.Position);
                const collision = this.world.getComponent(entityId, MapComponents.Collision);

                let targetX = position.x;
                let targetY = position.y;

                // 現在のタイル位置を基準に、次のタイルの中央を目指す
                const currentTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
                const currentTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);

                const baseTargetX = currentTileX * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;
                const baseTargetY = currentTileY * CONFIG.TILE_SIZE + (CONFIG.TILE_SIZE - CONFIG.PLAYER_SIZE) / 2;

                switch (this.input.direction) {
                    case 'up':    targetY = baseTargetY - CONFIG.TILE_SIZE; break;
                    case 'down':  targetY = baseTargetY + CONFIG.TILE_SIZE; break;
                    case 'left':  targetX = baseTargetX - CONFIG.TILE_SIZE; break;
                    case 'right': targetX = baseTargetX + CONFIG.TILE_SIZE; break;
                }

                // 移動先の当たり判定
                const bounds = {
                    x: targetX + collision.padding,
                    y: targetY + collision.padding,
                    width: collision.width - collision.padding * 2,
                    height: collision.height - collision.padding * 2,
                };

                // 向きコンポーネントを更新
                const existingFacingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
                if (existingFacingDirection) {
                    existingFacingDirection.direction = this.input.direction;
                } else {
                    this.world.addComponent(entityId, new MapComponents.FacingDirection(this.input.direction));
                }

                if (!this.map.isColliding(bounds)) {
                    // 状態を「歩行中」に遷移
                    state.value = PLAYER_STATES.WALKING;
                    // 目標地点コンポーネントを追加
                    this.world.addComponent(entityId, new MapComponents.TargetPosition(targetX, targetY));
                }
            }

            // Zキー入力によるバトルシーンへの移行処理
            if (this.input.pressedKeys.has('z')) {
                // メッセージウィンドウが表示されている間は処理しない
                // 冒頭でのチェックは、Zキー処理の直前でも必要（イベント発行のタイミング的な問題への対処）
                if (this.uiStateContext && this.uiStateContext.isPausedByModal) {
                    // Zキーが押された状態でも、モーダル中は処理しない
                    continue; // forループの次のイテレーションに進む
                }
                // プレイヤーの現在位置と向きを取得
                const playerEntityId = this.world.getEntitiesWith(MapComponents.PlayerControllable)[0];
                const position = this.world.getComponent(playerEntityId, MapComponents.Position);
                const facingDirection = this.world.getComponent(playerEntityId, MapComponents.FacingDirection);
                const playerTileX = Math.floor((position.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);
                const playerTileY = Math.floor((position.y + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE_SIZE);

                // NPCの位置を確認し、プレイヤーがNPCの隣にいて、かつNPCの方向を向いているかを判定
                for (const npc of this.map.npcs) {
                    const npcTileX = npc.x;
                    const npcTileY = npc.y;

                    // プレイヤーがNPCの隣にいて、かつNPCの方向を向いているかを判定
                    if (
                        (playerTileX === npcTileX && playerTileY === npcTileY - 1 && facingDirection.direction === 'down') || // 上
                        (playerTileX === npcTileX && playerTileY === npcTileY + 1 && facingDirection.direction === 'up') || // 下
                        (playerTileX === npcTileX - 1 && playerTileY === npcTileY && facingDirection.direction === 'right') || // 左
                        (playerTileX === npcTileX + 1 && playerTileY === npcTileY && facingDirection.direction === 'left')   // 右
                    ) {
                        // NPCとのインタラクションをリクエスト (メッセージウィンドウを表示させるため)
                        this.world.emit('NPC_INTERACTION_REQUESTED', npc); // NPCとのインタラクション要求イベントを発行
                        break; // 最初に見つかったNPCに対してのみ処理を行う
                    }
                }
            }
        }
    }
}

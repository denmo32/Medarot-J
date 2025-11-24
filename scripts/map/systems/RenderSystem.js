import { BaseSystem } from '../../engine/baseSystem.js';
import * as MapComponents from '../components.js';

export class RenderSystem extends BaseSystem {
    constructor(world, renderer, map, camera) {
        super(world);
        this.renderer = renderer;
        this.map = map;
        this.camera = camera;
    }

    update(deltaTime) {
        this.renderer.ctx.clearRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        
        this.renderer.ctx.save();
        this.renderer.ctx.translate(-this.camera.x, -this.camera.y);

        this.map.draw(this.renderer, this.camera);

        const entitiesToRender = this.world.getEntitiesWith(MapComponents.Position, MapComponents.Renderable);
        for (const entityId of entitiesToRender) {
            const position = this.world.getComponent(entityId, MapComponents.Position);
            const renderable = this.world.getComponent(entityId, MapComponents.Renderable);

            if (renderable.shape === 'circle') {
                this.renderer.drawCircle(
                    position.x + renderable.size / 2,
                    position.y + renderable.size / 2,
                    renderable.size / 2,
                    renderable.color
                );
                
                // 向きに応じた印（ドット）を描画
                this._drawDirectionIndicator(entityId, position, renderable);

            } else if (renderable.shape === 'rect') {
                this.renderer.drawRect(
                    position.x,
                    position.y,
                    renderable.size,
                    renderable.size,
                    renderable.color
                );
            }
        }

        this.renderer.ctx.restore();
    }

    /**
     * エンティティの向きを示すインジケーター（小さな黒い円）を描画します。
     * @param {number} entityId - エンティティID
     * @param {Position} position - 位置コンポーネント
     * @param {Renderable} renderable - 描画可能コンポーネント
     * @private
     */
    _drawDirectionIndicator(entityId, position, renderable) {
        const facingDirection = this.world.getComponent(entityId, MapComponents.FacingDirection);
        if (!facingDirection) return;

        const dotRadius = 2;
        let dotX, dotY;
        
        const centerX = position.x + renderable.size / 2;
        const centerY = position.y + renderable.size / 2;
        const offset = renderable.size / 4; // 中心からのオフセット量

        switch (facingDirection.direction) {
            case 'up':
                dotX = centerX;
                dotY = centerY - offset;
                break;
            case 'down':
                dotX = centerX;
                dotY = centerY + offset;
                break;
            case 'left':
                dotX = centerX - offset;
                dotY = centerY;
                break;
            case 'right':
                dotX = centerX + offset;
                dotY = centerY;
                break;
            default:
                dotX = centerX;
                dotY = centerY;
        }
        
        this.renderer.drawCircle(dotX, dotY, dotRadius, '#000');
    }
}

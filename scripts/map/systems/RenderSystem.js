import { BaseSystem } from '../../core/baseSystem.js';
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
}

import { System } from '../../../engine/core/System.js';
import { Position } from '../../components/map/Position.js';
import { Renderable } from '../../components/map/Renderable.js';
import { FacingDirection } from '../../components/map/FacingDirection.js';

export class RenderSystem extends System {
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

        const entitiesToRender = this.getEntities(Position, Renderable);
        for (const entityId of entitiesToRender) {
            const position = this.world.getComponent(entityId, Position);
            const renderable = this.world.getComponent(entityId, Renderable);

            if (renderable.shape === 'circle') {
                this.renderer.drawCircle(
                    position.x + renderable.size / 2,
                    position.y + renderable.size / 2,
                    renderable.size / 2,
                    renderable.color
                );
                
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

    _drawDirectionIndicator(entityId, position, renderable) {
        const facingDirection = this.world.getComponent(entityId, FacingDirection);
        if (!facingDirection) return;

        const dotRadius = 2;
        let dotX, dotY;
        
        const centerX = position.x + renderable.size / 2;
        const centerY = position.y + renderable.size / 2;
        const offset = renderable.size / 4;

        switch (facingDirection.direction) {
            case 'up':    dotX = centerX; dotY = centerY - offset; break;
            case 'down':  dotX = centerX; dotY = centerY + offset; break;
            case 'left':  dotX = centerX - offset; dotY = centerY; break;
            case 'right': dotX = centerX + offset; dotY = centerY; break;
            default:      dotX = centerX; dotY = centerY;
        }
        
        this.renderer.drawCircle(dotX, dotY, dotRadius, '#000');
    }
}

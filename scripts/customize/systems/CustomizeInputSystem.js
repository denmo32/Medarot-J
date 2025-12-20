/**
 * @file CustomizeInputSystem.js
 * @description 入力を検知してリクエストコンポーネントを生成する。
 */
import { System } from '../../../engine/core/System.js';
import { InputManager } from '../../../engine/input/InputManager.js';
import { 
    CustomizeNavigateRequest, 
    CustomizeConfirmRequest, 
    CustomizeCancelRequest 
} from '../components/CustomizeRequests.js';

export class CustomizeInputSystem extends System {
    constructor(world) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
    }

    update(deltaTime) {
        if (!this.input) return;

        if (this.input.wasKeyJustPressed('z')) {
            this.world.addComponent(this.world.createEntity(), new CustomizeConfirmRequest());
        } else if (this.input.wasKeyJustPressed('x')) {
            this.world.addComponent(this.world.createEntity(), new CustomizeCancelRequest());
        }

        const verticalMove = this.input.wasKeyJustPressed('ArrowDown') ? 1 : this.input.wasKeyJustPressed('ArrowUp') ? -1 : 0;
        if (verticalMove !== 0) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new CustomizeNavigateRequest(verticalMove > 0 ? 'down' : 'up'));
        }
        
        const horizontalMove = this.input.wasKeyJustPressed('ArrowRight') ? 1 : this.input.wasKeyJustPressed('ArrowLeft') ? -1 : 0;
        if (horizontalMove !== 0) {
            const req = this.world.createEntity();
            this.world.addComponent(req, new CustomizeNavigateRequest(horizontalMove > 0 ? 'right' : 'left'));
        }
    }
}
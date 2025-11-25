import { System } from '../../../engine/core/System.js'; // BaseSystem -> System
import { InputManager } from '../../../engine/input/InputManager.js';
import { CustomizeState } from '../components/CustomizeState.js';
import { GameEvents } from '../../common/events.js';

export class CustomizeInputSystem extends System {
    constructor(world) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
        this.uiState = this.world.getSingletonComponent(CustomizeState);
    }

    update(deltaTime) {
        if (!this.input) return;

        if (this.input.wasKeyJustPressed('z')) {
            this.world.emit(GameEvents.CUST_CONFIRM_INPUT);
        } else if (this.input.wasKeyJustPressed('x')) {
            this.world.emit(GameEvents.CUST_CANCEL_INPUT);
        }

        const verticalMove = this.input.wasKeyJustPressed('ArrowDown') ? 1 : this.input.wasKeyJustPressed('ArrowUp') ? -1 : 0;
        if (verticalMove !== 0) {
            this.world.emit(GameEvents.CUST_NAVIGATE_INPUT, { direction: verticalMove > 0 ? 'down' : 'up' });
        }
        
        const horizontalMove = this.input.wasKeyJustPressed('ArrowRight') ? 1 : this.input.wasKeyJustPressed('ArrowLeft') ? -1 : 0;
        if (horizontalMove !== 0) {
            this.world.emit(GameEvents.CUST_NAVIGATE_INPUT, { direction: horizontalMove > 0 ? 'right' : 'left' });
        }
    }
}
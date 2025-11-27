/**
 * @file TitleScene.js
 */
import { Scene } from '../../engine/scene/Scene.js';
import { InputManager } from '../../engine/input/InputManager.js';

export class TitleScene extends Scene {
    constructor(world, sceneManager) {
        super(world, sceneManager);
        this.input = null;
        this.gameDataManager = null;
        
        this.dom = {
            startNewBtn: document.getElementById('start-new-game'),
            startLoadBtn: document.getElementById('start-from-save')
        };
        
        this.buttons = [];
        this.focusedIndex = 0;
    }

    init(data) {
        console.log("Initializing Title Scene...");
        this.gameDataManager = data.gameDataManager;
        
        this.input = this.world.getSingletonComponent(InputManager);

        this._setupUI();
        this._updateFocus();
    }

    update(deltaTime) {
        super.update(deltaTime);
        this._handleInput();
    }

    _setupUI() {
        this.buttons = [this.dom.startNewBtn];

        if (localStorage.getItem('medarotJSaveData')) {
            this.dom.startLoadBtn.style.display = 'block';
            this.buttons.push(this.dom.startLoadBtn);
        } else {
            this.dom.startLoadBtn.style.display = 'none';
        }

        this.dom.startNewBtn.onclick = () => this._startGame(true);
        this.dom.startLoadBtn.onclick = () => this._startGame(false);
    }

    _handleInput() {
        if (!this.input || this.buttons.length === 0) return;

        if (this.input.wasKeyJustPressed('ArrowUp')) {
            this.focusedIndex = (this.focusedIndex - 1 + this.buttons.length) % this.buttons.length;
            this._updateFocus();
        }
        if (this.input.wasKeyJustPressed('ArrowDown')) {
            this.focusedIndex = (this.focusedIndex + 1) % this.buttons.length;
            this._updateFocus();
        }
        if (this.input.wasKeyJustPressed('z')) {
            const btn = this.buttons[this.focusedIndex];
            if (btn) btn.click();
        }
    }

    _updateFocus() {
        this.buttons.forEach((btn, index) => {
            if (index === this.focusedIndex) btn.focus();
            else btn.blur();
        });
    }

    async _startGame(isNewGame) {
        if (!this.gameDataManager) return;

        if (isNewGame) {
            this.gameDataManager.resetToDefault();
            console.log("Starting New Game...");
        } else {
            this.gameDataManager.loadGame();
            console.log("Loading Game from Save...");
        }

        await this.sceneManager.switchTo('map');
    }

    destroy() {
        console.log("Destroying Title Scene...");
        if (this.dom.startNewBtn) this.dom.startNewBtn.onclick = null;
        if (this.dom.startLoadBtn) this.dom.startLoadBtn.onclick = null;
        
        super.destroy();
    }
}
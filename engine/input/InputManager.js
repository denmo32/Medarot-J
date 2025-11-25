/**
 * @file 入力管理クラス
 * @description キーボード入力の状態を管理し、抽象的な入力情報を提供します。
 */
export class InputManager {
    /**
     * @param {object} [config={}]
     * @param {object} [config.keyMap={}]
     * @param {string[]} [config.preventDefaultKeys=[]]
     */
    constructor(config = {}) {
        this.keyMap = config.keyMap || {};
        this.preventDefaultKeys = new Set(config.preventDefaultKeys || []);

        this.pressedKeys = new Set();
        this.justPressedKeys = new Set();
        this.justReleasedKeys = new Set();

        this._direction = null;
        this._lastDirectionKey = null;
        this.directionActions = new Set(['up', 'down', 'left', 'right']);

        this._boundKeyDown = this._handleKeyDown.bind(this);
        this._boundKeyUp = this._handleKeyUp.bind(this);

        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup', this._boundKeyUp);
    }

    destroy() {
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
    }

    _handleKeyDown(e) {
        if (this.keyMap[e.key] || this.preventDefaultKeys.has(e.key)) {
            e.preventDefault();
            
            if (!this.pressedKeys.has(e.key)) {
                this.justPressedKeys.add(e.key);
            }
            this.pressedKeys.add(e.key);

            const action = this.keyMap[e.key];
            if (action && this.directionActions.has(action)) {
                this._lastDirectionKey = e.key;
            }
        }
    }

    _handleKeyUp(e) {
        if (this.keyMap[e.key] || this.preventDefaultKeys.has(e.key)) {
            e.preventDefault();
            this.pressedKeys.delete(e.key);
            this.justReleasedKeys.add(e.key);

            if (this._lastDirectionKey === e.key) {
                const pressedDirectionKeys = [...this.pressedKeys].filter(key => {
                    const action = this.keyMap[key];
                    return action && this.directionActions.has(action);
                });
                this._lastDirectionKey = pressedDirectionKeys.pop() || null;
            }
        }
    }

    update() {
        this.justPressedKeys.clear();
        this.justReleasedKeys.clear();
    }

    isKeyPressed(key) {
        return this.pressedKeys.has(key);
    }

    wasKeyJustPressed(key) {
        return this.justPressedKeys.has(key);
    }

    wasKeyJustReleased(key) {
        return this.justReleasedKeys.has(key);
    }
    
    get direction() {
        if (this._lastDirectionKey) {
            return this.keyMap[this._lastDirectionKey];
        }
        return null;
    }
}
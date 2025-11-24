/**
 * @file アプリケーション全体の入力を一元管理するシングルトンクラス
 * 
 * 特定のゲーム設定（KEY_MAPなど）への依存を排除し、
 * 初期化時に設定オブジェクトを受け取ることで汎用性を高めています。
 */
export class InputManager {
    /**
     * @param {object} [config={}]
     * @param {object} [config.keyMap={}] - キーコードとアクション名のマッピング { 'ArrowUp': 'up', ... }
     * @param {string[]} [config.preventDefaultKeys=[]] - デフォルト動作を無効化するキーのリスト
     */
    constructor(config = {}) {
        if (InputManager.instance) {
            return InputManager.instance;
        }

        this.keyMap = config.keyMap || {};
        this.preventDefaultKeys = new Set(config.preventDefaultKeys || []);

        this.pressedKeys = new Set();
        this.justPressedKeys = new Set();
        this.justReleasedKeys = new Set();

        this._direction = null;
        this._lastDirectionKey = null;

        // 方向キーとして扱うアクション名のセット（移動ロジック用）
        this.directionActions = new Set(['up', 'down', 'left', 'right']);

        window.addEventListener('keydown', this._handleKeyDown.bind(this));
        window.addEventListener('keyup', this._handleKeyUp.bind(this));

        InputManager.instance = this;
    }

    _handleKeyDown(e) {
        // keyMapに登録されている、またはpreventDefaultKeysに含まれている場合はデフォルト動作を防ぐ
        if (this.keyMap[e.key] || this.preventDefaultKeys.has(e.key)) {
            e.preventDefault();
            
            if (!this.pressedKeys.has(e.key)) {
                this.justPressedKeys.add(e.key);
            }
            this.pressedKeys.add(e.key);

            // 方向キーの判定ロジック
            // keyMapでマッピングされたアクションが方向系なら記録する
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
                // 離されたキーが最後の方向キーだった場合、まだ押されている他の方向キーを探す
                const pressedDirectionKeys = [...this.pressedKeys].filter(key => {
                    const action = this.keyMap[key];
                    return action && this.directionActions.has(action);
                });
                this._lastDirectionKey = pressedDirectionKeys.pop() || null;
            }
        }
    }

    /**
     * メインループの最初に呼び出し、キーの状態を更新します。
     */
    update() {
        this.justPressedKeys.clear();
        this.justReleasedKeys.clear();
    }

    /**
     * 指定されたキーが現在押されているかを確認します。
     * @param {string} key - 確認するキー (e.g., 'ArrowUp', 'z')
     * @returns {boolean}
     */
    isKeyPressed(key) {
        return this.pressedKeys.has(key);
    }

    /**
     * 指定されたキーがこのフレームで「押された瞬間」であるかを確認します。
     * @param {string} key - 確認するキー
     * @returns {boolean}
     */
    wasKeyJustPressed(key) {
        return this.justPressedKeys.has(key);
    }

    /**
     * 指定されたキーがこのフレームで「離された瞬間」であるかを確認します。
     * @param {string} key - 確認するキー
     * @returns {boolean}
     */
    wasKeyJustReleased(key) {
        return this.justReleasedKeys.has(key);
    }
    
    /**
     * 現在押されている方向キーから、最新の入力方向を取得します。
     * keyMapの設定に基づき、'up', 'down', 'left', 'right' を返します。
     * @returns {string | null}
     */
    get direction() {
        if (this._lastDirectionKey) {
            return this.keyMap[this._lastDirectionKey];
        }
        return null;
    }
}
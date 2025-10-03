/**
 * @file アプリケーション全体の入力を一元管理するシングルトンクラス
 * 
 * なぜこのクラスが必要か？
 * - イベントリスナーの一元化: windowへのkeydown/keyupリスナー登録を一度だけに限定し、
 *   リスナーの重複登録や削除漏れといったバグを根本的に防ぎます。
 * - コンテキストベースの入力制御: 'map', 'battle-modal', 'menu' といったゲームの状況（コンテキスト）に応じて、
 *   どの入力処理を有効にするかを簡単に切り替えられます。これにより、モーダル表示中にプレイヤーが動いてしまう、といった不具合を防ぎます。
 * - キー状態の抽象化: 「押された瞬間」「押されている間」「離された瞬間」を明確に区別して扱えるメソッドを提供し、
 *   より信頼性の高い入力処理を簡単に記述できるようにします。
 */
import { KEY_MAP } from '../map/constants.js';

export class InputManager {
    constructor() {
        if (InputManager.instance) {
            return InputManager.instance;
        }

        this.pressedKeys = new Set();
        this.justPressedKeys = new Set();
        this.justReleasedKeys = new Set();

        this._direction = null;
        this._lastDirectionKey = null;

        window.addEventListener('keydown', this._handleKeyDown.bind(this));
        window.addEventListener('keyup', this._handleKeyUp.bind(this));

        InputManager.instance = this;
    }

    _handleKeyDown(e) {
        if (KEY_MAP[e.key]) {
            // 常にpreventDefaultを呼ぶと、テキスト入力などができなくなるため、
            // ゲームの主要な操作キー（KEY_MAPにあるもの）に限定する
            e.preventDefault();
            
            if (!this.pressedKeys.has(e.key)) {
                this.justPressedKeys.add(e.key);
            }
            this.pressedKeys.add(e.key);

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                this._lastDirectionKey = e.key;
            }
        }
    }

    _handleKeyUp(e) {
        if (KEY_MAP[e.key]) {
            e.preventDefault();
            this.pressedKeys.delete(e.key);
            this.justReleasedKeys.add(e.key);

            if (this._lastDirectionKey === e.key) {
                const pressedDirectionKeys = [...this.pressedKeys].filter(key => ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key));
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
     * @returns {string | null} 'up', 'down', 'left', 'right' または null
     */
    get direction() {
        if (this._lastDirectionKey) {
            return KEY_MAP[this._lastDirectionKey];
        }
        return null;
    }
}

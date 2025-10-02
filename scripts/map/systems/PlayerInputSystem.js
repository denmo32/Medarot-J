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
        // メニューが表示されている場合、マップへの入力は無効化
        const menuElement = document.getElementById('map-menu');
        if (menuElement && !menuElement.classList.contains('hidden')) {
            // Xキーのみメニュー閉じるために処理
            if (this.input.pressedKeys.has('x')) {
                this.toggleMenu();
                this.input.pressedKeys.delete('x');
            }
            // 他の入力は無視
            return;
        }

        // カスタマイズ画面が表示されている場合も、マップへの入力は無効化
        const customizeElement = document.getElementById('customize-container');
        if (customizeElement && !customizeElement.classList.contains('hidden')) {
            // console.log('Customize scene open, pressedKeys:', this.input.pressedKeys); // デバッグ用
            // Xキーでカスタマイズ画面を閉じる処理は、イベントリスナー側で行うため、ここでは何もしない
            // 他の入力は無効化
            return;
        }

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

            // Xキー入力によるポーズメニューの開閉処理
            if (this.input.pressedKeys.has('x')) {
                this.toggleMenu();
                // Xキーが押されたことを示すフラグを立てる（1フレーム分の入力として扱う）
                this.input.pressedKeys.delete('x');
            }
        }
    }

    toggleMenu() {
        const menuElement = document.getElementById('map-menu');
        if (menuElement) {
            if (!menuElement.classList.contains('hidden')) {
                // メニューが開いている場合は閉じる
                // メニューが閉じるアニメーションの開始時にイベントリスナーを削除
                this.isMenuClosing = true;
                this.removeMenuEventListeners();
            } else {
                // メニューが開く前にAbortControllerを初期化
                this.abortController = new AbortController();
            }
            menuElement.classList.toggle('hidden');
            if (!menuElement.classList.contains('hidden')) {
                // メニューが開いたときにイベントリスナーを設定
                this.setupMenuEventListeners();
            }
        }
    }

    setupMenuEventListeners() {
        // AbortControllerを初期化
        this.abortController = new AbortController();

        const saveButton = document.querySelector('.map-menu-button[data-action="save"]');
        const medarotchiButton = document.querySelector('.map-menu-button[data-action="medarotchi"]');
        this.buttons = [medarotchiButton, saveButton]; // フォーカス順にボタンを配列に格納
        this.focusedIndex = 0; // 最初は最初のボタン（メダロッチ）にフォーカス

        // 初期フォーカスを設定
        if (this.buttons[this.focusedIndex]) {
            this.buttons[this.focusedIndex].focus();
            this.addFocusIndicator(this.buttons[this.focusedIndex]);
        }

        // キーボードイベントリスナーを設定
        this.handleKeyDown = (e) => {
            switch(e.key) {
                case 'ArrowUp':
                    // 上キー：フォーカスを前のボタンに移動
                    if (this.focusedIndex > 0) {
                        this.focusedIndex--;
                    } else {
                        // 最初のボタンの場合は最後のボタンに戻る
                        this.focusedIndex = this.buttons.length - 1;
                    }
                    break;
                case 'ArrowDown':
                    // 下キー：フォーカスを次のボタンに移動
                    if (this.focusedIndex < this.buttons.length - 1) {
                        this.focusedIndex++;
                    } else {
                        // 最後のボタンの場合は最初のボタンに戻る
                        this.focusedIndex = 0;
                    }
                    break;
                case 'z':
                case 'Z':
                    // Zキー：フォーカス中のボタンをクリック
                    if (this.buttons[this.focusedIndex]) {
                        this.buttons[this.focusedIndex].click();
                    }
                    break;
            }

            // 新しいフォーカス対象を設定
            if (this.buttons[this.focusedIndex]) {
                this.buttons[this.focusedIndex].focus();
                this.addFocusIndicator(this.buttons[this.focusedIndex]); // 新しいフォーカス対象に三角を追加
            }
        };

        // ボタンにイベントリスナーを追加
        document.addEventListener('keydown', this.handleKeyDown, { signal: this.abortController.signal });

        // ボタンのクリックイベントを設定
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveGame();
                this.toggleMenu(); // セーブ後はメニューを閉じる
            }, { signal: this.abortController.signal });
        }

        if (medarotchiButton) {
            medarotchiButton.addEventListener('click', () => {
                this.openCustomizeScene();
                this.toggleMenu(); // カスタマイズシーンを開いた後はメニューを閉じる
            }, { signal: this.abortController.signal });
        }

        // メニューが閉じるときのイベントリスナーを設定
        const menuElement = document.getElementById('map-menu');
        if (menuElement) {
            const handleMenuClose = () => {
                // 三角のフォーカスインジケーターをすべて削除
                this.removeFocusIndicators();
            };

            menuElement.addEventListener('transitionend', () => {
                if (menuElement.classList.contains('hidden')) {
                    handleMenuClose();
                }
            }, { signal: this.abortController.signal });

            // メニューが閉じるアニメーションの開始時にイベントリスナーを削除するためのフラグを設定
            this.isMenuClosing = false;
            menuElement.addEventListener('transitionstart', () => {
                this.isMenuClosing = true;
            }, { signal: this.abortController.signal });
        }
    }

    removeMenuEventListeners() {
        if (this.abortController) {
            this.abortController.abort();
        }
        // 三角のフォーカスインジケーターをすべて削除
        this.removeFocusIndicators();
        
        // メニューが閉じるアニメーションの開始時にイベントリスナーを削除するためのフラグをリセット
        this.isMenuClosing = false;
    }

    // 三角(▶)のフォーカスインジケーターを追加する関数
    addFocusIndicator(button) {
        // 既存のインジケーターを削除
        this.removeFocusIndicators();
        // 新しいインジケーターを追加
        document.querySelector('.map-menu-content').insertAdjacentHTML('afterbegin', '<span class="focus-indicator">▶</span>');
        // インジケーターの位置を調整
        const indicator = document.querySelector('.focus-indicator');
        if (indicator) {
            const buttonRect = button.getBoundingClientRect();
            const menuContentRect = document.querySelector('.map-menu-content').getBoundingClientRect();
            indicator.style.top = `${button.offsetTop + (button.offsetHeight - 20) / 2}px`;
        }
    }

    // 全ての三角(▶)のフォーカスインジケーターを削除する関数
    removeFocusIndicators() {
        const indicators = document.querySelectorAll('.focus-indicator');
        indicators.forEach(indicator => indicator.remove());
    }

    saveGame() {
        const playerEntities = this.world.getEntitiesWith(
            MapComponents.PlayerControllable,
            MapComponents.Position
        );

        if (playerEntities.length > 0) {
            const playerEntityId = playerEntities[0];
            const position = this.world.getComponent(playerEntityId, MapComponents.Position);

            const gameState = {
                position: {
                    x: position.x,
                    y: position.y
                },
                mapName: 'map.json' // 将来的にはマップ名を動的に取得する
            };

            localStorage.setItem('medarotJSaveData', JSON.stringify(gameState));
            console.log('Game saved successfully:', gameState);
        }
    }

    openCustomizeScene() {
        // カスタマイズシーンを読み込む
        import('../../customize/scene.js')
            .then(module => {
                module.setupCustomizeMode(this.world);
                // console.log('Called setupCustomizeMode with world:', this.world);
            })
            .catch(err => {
                console.error('Failed to load customize scene:', err);
            });
    }
}

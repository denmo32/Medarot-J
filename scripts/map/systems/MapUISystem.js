/**
 * @file MapUISystem.js
 * @description マップUIシステム。
 * イベント駆動からコンポーネントリクエスト処理へ変更。
 */
import { System } from '../../../engine/core/System.js';
import { MapUIState } from '../../scenes/MapScene.js';
import { InputManager } from '../../../engine/input/InputManager.js';
import { MapUIManager } from '../ui/MapUIManager.js';
import { 
    ToggleMenuRequest, 
    ShowNpcDialogRequest,
    GameSaveRequest,
    MenuActionRequest
} from '../components/MapRequests.js';
import { SceneChangeRequest } from '../../components/SceneRequests.js';

export class MapUISystem extends System {
    constructor(world) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
        this.mapUIState = this.world.getSingletonComponent(MapUIState);
        this.uiManager = new MapUIManager();

        this.focusedMenuIndex = 0;
    }
    
    destroy() {
        this.uiManager.hideMenu();
        this.uiManager.hideInteractionWindow();
        super.destroy();
    }

    update(deltaTime) {
        if (!this.input) return;

        // 1. リクエスト処理
        this._processShowNpcDialogRequests();
        this._processToggleMenuRequests(); // 外部からの要求があれば
        this._processMenuActionRequests();
        this._processGameSaveRequests();

        // 2. 入力処理
        if (this.input.wasKeyJustPressed('x') && !this.mapUIState.isPausedByModal) {
            this.toggleMenu();
            return;
        }

        if (this.mapUIState && this.mapUIState.isMapMenuVisible) {
            this.handleMenuInput();
        } else if (this.mapUIState && this.mapUIState.isPausedByModal) {
            this.handleInteractionWindowInput();
        }
    }

    _processShowNpcDialogRequests() {
        const requests = this.getEntities(ShowNpcDialogRequest);
        for (const id of requests) {
            const req = this.world.getComponent(id, ShowNpcDialogRequest);
            this.showNpcInteraction(req.npcData);
            this.world.destroyEntity(id);
        }
    }

    _processToggleMenuRequests() {
        const requests = this.getEntities(ToggleMenuRequest);
        for (const id of requests) {
            this.toggleMenu();
            this.world.destroyEntity(id);
        }
    }

    _processMenuActionRequests() {
        const requests = this.getEntities(MenuActionRequest);
        for (const id of requests) {
            const req = this.world.getComponent(id, MenuActionRequest);
            if (req.actionType === 'save') {
                this.saveGame();
                this.closeMenu();
            } else if (req.actionType === 'medarotchi') {
                this.openCustomizeScene();
                this.closeMenu();
            }
            this.world.destroyEntity(id);
        }
    }

    _processGameSaveRequests() {
        // 保存リクエストはScene側（あるいはGameDataManager）が永続化を担当するが、
        // ここでは「保存アクションがトリガーされた」ことを通知する。
        // 実際には GameDataManager がコンポーネントを監視しているわけではないので、
        // シーンクラス内での連携が必要、もしくはここで直接 GameDataManager を叩く必要があるが、
        // ECS原則的には、"SaveRequested" タグを付けて、PersistenceSystem が処理するのが正しい。
        // 今回は既存実装に合わせて、Sceneに委譲...したいが、SceneはSystemを知らない。
        // -> Sceneクラスのupdateで GameSaveRequest を監視するのが良い。
    }

    toggleMenu() {
        if (!this.mapUIState) return;

        if (this.mapUIState.isMapMenuVisible) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        if (!this.mapUIState) return;
        
        this.mapUIState.isMapMenuVisible = true;
        this.mapUIState.isPausedByModal = true;
        this.uiManager.showMenu();

        this.focusedMenuIndex = 0;
        
        // アクションのバインド（クロージャでリクエスト発行）
        this.uiManager.bindMenuAction('save', () => { 
            const req = this.world.createEntity();
            this.world.addComponent(req, new MenuActionRequest('save'));
        });
        this.uiManager.bindMenuAction('medarotchi', () => { 
            const req = this.world.createEntity();
            this.world.addComponent(req, new MenuActionRequest('medarotchi'));
        });
        
        this.uiManager.updateMenuFocus(this.focusedMenuIndex);
    }

    closeMenu() {
        if (!this.mapUIState) return;

        this.mapUIState.isMapMenuVisible = false;
        this.mapUIState.isPausedByModal = false;
        this.uiManager.hideMenu();
    }

    handleMenuInput() {
        const count = this.uiManager.getMenuButtonCount();
        if (count === 0) return;

        if (this.input.wasKeyJustPressed('ArrowUp')) {
            this.focusedMenuIndex = (this.focusedMenuIndex > 0) ? this.focusedMenuIndex - 1 : count - 1;
            this.uiManager.updateMenuFocus(this.focusedMenuIndex);
        }
        if (this.input.wasKeyJustPressed('ArrowDown')) {
            this.focusedMenuIndex = (this.focusedMenuIndex < count - 1) ? this.focusedMenuIndex + 1 : 0;
            this.uiManager.updateMenuFocus(this.focusedMenuIndex);
        }
        if (this.input.wasKeyJustPressed('z')) {
            this.uiManager.triggerMenuButton(this.focusedMenuIndex);
        }
        if (this.input.wasKeyJustPressed('x')) {
            this.closeMenu();
        }
    }

    saveGame() {
        // シーンクラスがこれを検知して永続化を実行する
        const req = this.world.createEntity();
        this.world.addComponent(req, new GameSaveRequest());
    }

    openCustomizeScene() {
        const req = this.world.createEntity();
        this.world.addComponent(req, new SceneChangeRequest('customize'));
    }

    showNpcInteraction(npc) {
        if (!this.mapUIState) return;

        this.mapUIState.isPausedByModal = true;
        this.mapUIState.modalJustOpened = true; 

        const closeWindow = () => {
            this.uiManager.hideInteractionWindow();
            if (this.mapUIState) this.mapUIState.isPausedByModal = false;
        };

        const onConfirm = () => {
            closeWindow();
            // バトルへ遷移
            const req = this.world.createEntity();
            this.world.addComponent(req, new SceneChangeRequest('battle'));
        };

        const onCancel = () => {
            closeWindow();
            document.getElementById('game-canvas')?.focus();
        };

        this.uiManager.bindInteractionActions(onConfirm, onCancel);
        this.uiManager.showInteractionWindow();
    }

    handleInteractionWindowInput() {
        if (this.mapUIState.modalJustOpened) {
            this.mapUIState.modalJustOpened = false;
            return;
        }

        if (this.input.wasKeyJustPressed('ArrowLeft') || this.input.wasKeyJustPressed('ArrowRight') || this.input.wasKeyJustPressed('ArrowUp') || this.input.wasKeyJustPressed('ArrowDown')) {
            if (document.activeElement?.id === 'confirm-battle-button') {
                this.uiManager.focusCancelButton();
            } else {
                this.uiManager.focusConfirmButton();
            }
        }

        if (this.input.wasKeyJustPressed('z')) {
            this.uiManager.clickActiveButton();
        }

        if (this.input.wasKeyJustPressed('x')) {
            this.uiManager.clickCancelButton();
        }
    }
}
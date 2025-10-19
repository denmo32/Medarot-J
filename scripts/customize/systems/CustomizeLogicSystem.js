/**
 * @file カスタマイズ画面：ロジックシステム
 * UIから発行されたイベントに基づき、実際のゲームデータ（パーツの装備など）を
 * 更新するビジネスロジックを実行する責務を持ちます。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { GameDataManager } from '../../core/GameDataManager.js';

export class CustomizeLogicSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.dataManager = new GameDataManager();

        this.world.on('EQUIP_PART_REQUESTED', this.onEquipPartRequested.bind(this));
    }

    /**
     * パーツ装備要求イベントのハンドラ
     * @param {object} detail - イベントペイロード { medarotIndex, partSlot, newPartId }
     */
    onEquipPartRequested(detail) {
        const { medarotIndex, partSlot, newPartId } = detail;
        this.equipPart(medarotIndex, partSlot, newPartId);
    }

    /**
     * 選択したパーツをメダロットに装備させる。
     * @param {number} medarotIndex - 更新するメダロットのインデックス
     * @param {string} partSlot - 更新するパーツのスロット
     * @param {string} newPartId - 新しいパーツのID
     */
    equipPart(medarotIndex, partSlot, newPartId) {
        if (!newPartId) return;

        this.dataManager.updateMedarotPart(medarotIndex, partSlot, newPartId);
        this.dataManager.saveGame(); // パーツ交換のたびにセーブ

        // 装備完了をUIシステムに通知し、再描画をトリガーさせる
        this.world.emit('PART_EQUIPPED');
    }

    update(deltaTime) {
        // イベント駆動のためupdate処理は不要
    }
}